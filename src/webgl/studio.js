import {
  CanvasTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HemisphereLight,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
} from 'three';

/**
 * Студия: материалы корпуса, окружение и свет.
 *
 * Цвет снят с самих рендеров из SVG (`public/products/*.webp`, выборка по
 * корпусу без области экрана). Распределение яркости там такое:
 *
 *   POS    медиана #0e0e0e · p85 #212121 · p95 #3e3e3e · p99 #646464 · max #ffffff
 *   киоск  медиана #11120f · p85 #171717 · p95 #28272a · p99 #6b6b6b · max #ffffff
 *
 * То есть корпус действительно почти чёрный, но у него длинный светлый хвост:
 * один процент пикселей уходит в 100…255. Это и есть глянец — не осветление
 * поверхности, а узкие яркие блики софтбоксов по фаскам и кромкам.
 *
 * Отсюда рецепт: очень тёмный base color, нулевая металличность и жёсткий
 * лаковый слой (clearcoat) с малой шероховатостью. Плоские грани отражают
 * тёмную комнату и остаются чёрными, а скруглённые кромки собирают софтбокс
 * в тонкую светлую полосу — ровно как на фотографии.
 */

/**
 * Равнопромежуточная карта окружения: тёмная комната с несколькими
 * софтбоксами. Края источников намеренно резковаты — размытое пятно даёт
 * общий «налёт» по всей плоскости, а нужна именно полоса по фаске.
 */
function environmentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Комната тёмная: всё, что не софтбокс, корпус отражает как черноту.
  const room = ctx.createLinearGradient(0, 0, 0, canvas.height);
  room.addColorStop(0, '#111417');
  room.addColorStop(0.45, '#080a0c');
  room.addColorStop(0.75, '#030405');
  room.addColorStop(1, '#090b0d');
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /** Софтбокс: яркое ядро с коротким спадом, а не мягкое облако. */
  const softbox = (x, y, w, h, intensity) => {
    const gradient = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.16, `rgba(255,255,255,${intensity})`);
    gradient.addColorStop(0.84, `rgba(255,255,255,${intensity})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.filter = 'blur(11px)';
    ctx.fillStyle = gradient;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.restore();
  };

  // Источники компактные. Диффузная засветка от карты пропорциональна их
  // площади, а яркость блика — интенсивности: крупный софтбокс осветлил бы
  // корпус целиком вместо того, чтобы поставить полосу по фаске.
  softbox(232, 140, 132, 104, 1.6); // основной слева-сверху
  // Заполняющий ушёл с оси камеры (u≈0,75 — прямо за спиной зрителя): лицевые
  // грани смотрят туда и на нём серели целиком, а не ловили блик по кромке.
  softbox(846, 112, 84, 70, 1.15); // заполняющий справа
  softbox(512, 40, 300, 34, 0.75); // верхний
  softbox(52, 280, 64, 74, 0.5); // отсвет сбоку
  softbox(884, 296, 56, 66, 0.4); // контровой
  softbox(512, 476, 420, 26, 0.16); // пол

  // Дизеринг. Плавный тёмный градиент в 8 битах ложится ступеньками, и PMREM
  // переносит эти ступеньки в отражение — на корпусе они читаются полосами.
  // Шум в полбита ломает ступеньку, на глаз его не видно.
  const noise = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < noise.data.length; i += 4) {
    const d = (Math.random() - 0.5) * 5;
    noise.data[i] += d;
    noise.data[i + 1] += d;
    noise.data[i + 2] += d;
  }
  ctx.putImageData(noise, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createEnvironment(renderer) {
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(environmentTexture());
  pmrem.dispose();
  return target.texture;
}

/**
 * Материалы. Base color взят по медиане корпуса на рендерах; светлоту даёт не
 * он, а блик, поэтому осветлять его нельзя — корпус перестанет быть чёрным.
 */
export function createMaterials() {
  // Корпус: глянцевый чёрный пластик. Металличность нулевая — это не металл,
  // блик должен оставаться белым, а не краситься в цвет материала.
  // Base color отвечает только за диффузную часть: блик даёт лаковый слой и от
  // цвета не зависит. Поэтому корпус можно уводить в чёрный, не теряя глянца.
  const shell = new MeshPhysicalMaterial({
    color: 0x141414,
    // Шероховатость низкая: на матовой поверхности софтбокс размазывается по
    // всей грани и корпус сереет. При жёстком отражении плоскость видит тёмную
    // комнату и остаётся чёрной, а свет собирается на фасках.
    roughness: 0.26,
    metalness: 0,
    clearcoat: 1,
    // Не нулевая: на зеркальном лаке фаска ловит софтбокс в один пиксель и он
    // вспыхивает белой точкой. Небольшая шероховатость размазывает её в блик.
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.95,
    specularIntensity: 1,
  });

  // Плита и задняя панель: тот же пластик, но выделка матовее — на рендерах
  // они заметно спокойнее лицевых поверхностей.
  const shellMatte = new MeshPhysicalMaterial({
    color: 0x101010,
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.7,
  });

  // Лицевая плоскость вокруг матрицы: самое глянцевое место машины — стекло.
  const bezel = new MeshPhysicalMaterial({
    color: 0x08090a,
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    envMapIntensity: 1.3,
    specularIntensity: 1,
  });

  // Зелёная оправа сканера светится сама и не участвует в освещении сцены.
  const accent = new MeshBasicMaterial({ color: 0x2fbf94, toneMapped: false });

  const lens = new MeshPhysicalMaterial({
    color: 0x05060a,
    roughness: 0.09,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2,
  });

  const metal = new MeshPhysicalMaterial({
    color: 0x2a2d31,
    roughness: 0.3,
    metalness: 0.75,
    envMapIntensity: 1.2,
  });

  return { shell, shellMatte, bezel, accent, lens, metal };
}

/**
 * Экран не зависит от освещения: это источник изображения, а не поверхность.
 *
 * Фильтры текстуры здесь НЕ трогаем — они выставлены при загрузке (мипмапы и
 * анизотропия, см. screens.js). Раньше материал перетирал их на LinearFilter,
 * мипмапы отключались, и точечный растр логотипа на наклонённом экране
 * рассыпался — те самые «поплывшие кружочки».
 */
export function createScreenMaterial(texture) {
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
  material.map.colorSpace = SRGBColorSpace;
  return material;
}

/**
 * Свет предметной съёмки. Основную светлоту корпусу даёт не он, а отражение
 * софтбоксов из окружения: направленные источники поддерживают объём и рисуют
 * тень.
 */
export function createLights(scene) {
  const key = new DirectionalLight(0xffffff, 0.5);
  key.position.set(-1.6, 3.1, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.2;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new DirectionalLight(0xdfe7ee, 0.16);
  fill.position.set(3.0, 1.2, 2.2);
  scene.add(fill);

  // Контровой отбивает силуэт от почти чёрного фона.
  const rim = new DirectionalLight(0xffffff, 0.7);
  rim.position.set(-2.2, 2.2, -3.2);
  scene.add(rim);

  const sky = new HemisphereLight(0x6e757c, 0x101214, 0.06);
  scene.add(sky);

  return { key, fill, rim, sky };
}

export const disposeStudio = (materials) => {
  Object.values(materials).forEach((material) => material.dispose?.());
};

export { Scene };
