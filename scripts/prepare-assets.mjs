/**
 * Подготовка продуктовых изображений.
 *
 * Исходники — SVG-обёртки из макета, внутри которых лежит студийный PNG-рендер
 * оборудования на чёрном фоне. Задача скрипта: достать PNG, отделить фон от
 * корпуса и отдать сцене RGBA-текстуру, которую можно поставить в 3D-сцену,
 * а не плашкой на страницу. Форма и пропорции оборудования не меняются.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'products');

const SOURCES = [
  {
    svg: 'касса.svg',
    id: 'pos',
    // Область заставки на снимке: она идёт текстурой на дисплей 3D-модели,
    // поэтому экран в сцене выглядит ровно так же, как на фотографии.
    screen: { left: 74, top: 66, width: 872, height: 614 },
  },
  {
    svg: 'касса самообслуживания.svg',
    id: 'self-checkout',
    screen: { left: 48, top: 123, width: 442, height: 676 },
  },
];

/** Ширины, в которых раздаём текстуру: desktop и лёгкий вариант для мобильных. */
const WIDTHS = { full: 1400, lite: 720 };

/**
 * Ниже этого уровня яркости пиксель считаем студийным фоном. Фон на рендере
 * ровно нулевой, а самые тёмные грани корпуса — около 16, поэтому порог
 * держим низким: иначе заливка утекает внутрь оборудования.
 */
const BG_LUMA = 6;

/** Радиус морфологического закрытия, которым заращиваются тонкие протечки. */
const CLOSE_RADIUS = 4;

/** На столько сжимаем готовый силуэт: размытие яркости раздувает его на пару пикселей. */
const ERODE_RADIUS = 2;

async function extractPng(svgPath) {
  const svg = await readFile(svgPath, 'utf8');
  const match = svg.match(/xlink:href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  if (!match) throw new Error(`В ${svgPath} нет вшитого PNG`);
  return Buffer.from(match[1], 'base64');
}

/**
 * Заливка от границ кадра: фоном считается только то, что связано с краем.
 * Тёмные участки внутри корпуса (щели, тени между деталями) остаются непрозрачными,
 * иначе матовый чёрный корпус расползся бы дырами.
 *
 * На вход идёт сглаженная яркость: в тёмном градиенте корпуса есть дизеринг,
 * и по исходным пикселям заливка утекала внутрь ровными строками.
 */
function backgroundMask(luma, width, height) {
  const size = width * height;
  const isBg = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  const push = (i) => {
    if (isBg[i] || luma[i] > BG_LUMA) return;
    isBg[i] = 1;
    queue[tail++] = i;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }

  return isBg;
}

/** Раздельный по осям min/max-фильтр — основа dilate/erode. */
function morph(src, width, height, radius, pick) {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = src[y * width + x];
      for (let d = -radius; d <= radius; d++) {
        const nx = x + d;
        if (nx < 0 || nx >= width) continue;
        v = pick(v, src[y * width + nx]);
      }
      tmp[y * width + x] = v;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = tmp[y * width + x];
      for (let d = -radius; d <= radius; d++) {
        const ny = y + d;
        if (ny < 0 || ny >= height) continue;
        v = pick(v, tmp[ny * width + x]);
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

/** Закрытие: заращиваем щели, которыми фон просачивается в корпус, не раздувая силуэт. */
function close(mask, width, height, radius) {
  const dilated = morph(mask, width, height, radius, Math.max);
  return morph(dilated, width, height, radius, Math.min);
}

/** Сжатие силуэта — компенсирует расплывание, которое даёт сглаживание яркости. */
function erode(mask, width, height, radius) {
  return morph(mask, width, height, radius, Math.min);
}

function boundingBox(solid, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

async function process({ svg, id, screen }) {
  const png = await extractPng(join(root, svg));
  const base = sharp(png).ensureAlpha();
  const { width, height } = await base.metadata();
  const data = await base.raw().toBuffer();

  // Яркость считаем отдельным каналом и слегка размываем: маску строим по форме,
  // а не по попиксельному шуму рендера.
  const luma = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    luma[i] = Math.round(0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]);
  }
  const smooth = await sharp(luma, { raw: { width, height, channels: 1 } }).blur(2)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const isBg = backgroundMask(smooth, width, height);

  // Альфу собираем отдельным одноканальным слоем: его можно закрыть морфологией
  // и слегка размыть, чтобы край корпуса не получился «вырезанным ножницами».
  const raw = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) raw[i] = isBg[i] ? 0 : 255;
  const solid = erode(close(raw, width, height, CLOSE_RADIUS), width, height, ERODE_RADIUS);
  const alpha = Buffer.from(solid);

  const softAlpha = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .blur(1.1)
    .linear(1.35, -26) // возвращаем плотность, оставляя ~1px растушёвки
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    rgba[o] = data[o];
    rgba[o + 1] = data[o + 1];
    rgba[o + 2] = data[o + 2];
    rgba[o + 3] = softAlpha[i];
  }

  const { minX, minY, maxX, maxY } = boundingBox(solid, width, height);
  const pad = 8;
  const crop = {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(height, maxY + pad) - Math.max(0, minY - pad),
  };

  await mkdir(OUT, { recursive: true });

  const cut = sharp(rgba, { raw: { width, height, channels: 4 } }).extract(crop);
  const meta = { id, width: crop.width, height: crop.height, files: {} };

  for (const [name, w] of Object.entries(WIDTHS)) {
    const file = `${id}${name === 'full' ? '' : `-${name}`}.webp`;
    const info = await cut
      .clone()
      .resize({ width: w, height: w * 2, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(join(OUT, file));
    meta.files[name] = { file, width: info.width, height: info.height, kb: +(info.size / 1024).toFixed(1) };
  }

  if (screen) {
    const file = `${id}-screen.webp`;
    const info = await cut
      .clone()
      .extract(screen)
      // Логотип на заставке набран точками: на q88 они замыливались в кашу.
      .webp({ quality: 96, effort: 6, smartSubsample: false })
      .toFile(join(OUT, file));
    meta.files.screen = { file, width: info.width, height: info.height, kb: +(info.size / 1024).toFixed(1) };
  }

  console.log(id, `${width}x${height} → ${crop.width}x${crop.height}`, JSON.stringify(meta.files));
  return meta;
}

const result = [];
for (const src of SOURCES) result.push(await process(src));
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(result, null, 2));

/**
 * Картинка для ссылок в мессенджерах и соцсетях. Собирается из тех же файлов,
 * что и сайт: фирменный знак и подготовленный рендер оборудования.
 */
async function buildOgImage() {
  const W = 1200;
  const H = 630;

  const background = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <radialGradient id="glow" cx="78%" cy="45%" r="62%">
          <stop offset="0%" stop-color="#0d3a30"/>
          <stop offset="100%" stop-color="#050505"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#050505"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <text x="72" y="300" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="700" fill="#f4f4f2" letter-spacing="-2">ASOFT</text>
      <text x="72" y="356" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#9a9a96">Автоматизация торговли</text>
      <text x="72" y="424" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#5e5e5a">POS · Кассы самообслуживания · ПО · Сервис</text>
      <rect x="72" y="452" width="64" height="2" fill="#2fbf94"/>
    </svg>`);

  const emblem = await sharp(join(root, 'public', 'asoft-emblem.svg'))
    .resize({ width: 72 })
    .png()
    .toBuffer();

  const device = await sharp(join(OUT, 'pos.webp'))
    .resize({ height: 520, fit: 'inside' })
    .png()
    .toBuffer();
  const deviceMeta = await sharp(device).metadata();

  await sharp(background)
    .composite([
      { input: emblem, left: 72, top: 96 },
      { input: device, left: W - deviceMeta.width - 40, top: Math.round((H - deviceMeta.height) / 2) },
    ])
    .png()
    .toFile(join(root, 'public', 'og.png'));

  console.log('og.png 1200x630');
}

await buildOgImage();
