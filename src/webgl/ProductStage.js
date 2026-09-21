import {
  ACESFilmicToneMapping,
  Box3,
  Group,
  Mesh,
  ShadowMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { backdropFragment, backdropVertex } from './shaders.js';
import { BUILDERS } from './models.js';
import {
  createEnvironment,
  createLights,
  createMaterials,
  createScreenMaterial,
} from './studio.js';
import { createScreenTexture, createWordmarkTexture } from './screens.js';

/**
 * Сцена продуктовой истории.
 *
 * В кадре стоят настоящие 3D-модели оборудования (см. models.js): у корпуса есть
 * толщина, у стойки и основания — объём, экран утоплен за рамкой. Прокрутка и
 * курсор двигают камеру, положение и угол объекта, но никогда не трогают
 * геометрию: ни растяжения, ни перекоса, ни деформации сетки.
 *
 * Прогресс приходит снаружи числом 0..1 и раскладывается по кейфреймам. У каждой
 * главы их два — приход и удержание: внутри удержания кадр почти неподвижен,
 * и у читателя есть время на текст.
 *
 * Сознательно без React-обвязки: скролл не должен вызывать перерисовку дерева.
 */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Предел поворота от курсора: объект должен ощущаться вещью, а не вертушкой. */
const POINTER_YAW = 0.14; // ≈ 8°
const POINTER_PITCH = 0.07; // ≈ 4°

/**
 * Вес кадра задаёт длину отрезка, который в нём начинается.
 * Поэтому «приход» несёт вес удержания (после него кадр стоит и читается текст),
 * а «удержание» — вес перехода (после него камера едет к следующей главе).
 * Удержание заметно длиннее перехода: это и есть пауза на чтение.
 */
const WEIGHT_MOVE = 1;
const WEIGHT_HOLD = 2.2;

/**
 * Состояние объекта в кадре.
 * `fit` — какую долю высоты кадра занимает объект; расстояние до камеры считается
 * из неё, поэтому «приближение» получается настоящим доллингом, а не масштабом.
 */
const state = (over = {}) => ({
  x: 0,
  // Разнос по горизонтали в долях полуширины кадра, не зависящий от xScale.
  // xScale сжимает боковую композицию на узком экране — это верно, когда в
  // кадре одна машина, но герою с двумя нужен гарантированный зазор.
  xSpread: 0,
  y: 0,
  fit: 0.62,
  yaw: 0,
  pitch: 0,
  opacity: 1,
  glow: 1,
  ...over,
});

const FIELDS = Object.keys(state());

export class ProductStage {
  /**
   * @param host контейнер сцены; собственный canvas движок создаёт сам —
   *   так повторное монтирование (в том числе двойное в StrictMode) всегда
   *   получает чистый WebGL-контекст, а не чужой уже освобождённый.
   */
  constructor(host, { products, lite = false }) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'story__canvasel';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);

    this.products = products;
    this.lite = lite;

    this.progress = 0;
    this.pointer = new Vector2(0, 0);
    this.pointerTarget = new Vector2(0, 0);
    this.hint = null;
    this.hintMix = new Map(products.map((product) => [product.id, 0]));

    this.items = new Map();
    this.frames = [];
    this.narrow = false;
    this.layout = { xScale: 1, fitScale: 1 };
    this.tanHalfFov = Math.tan((30 * Math.PI) / 360);
    this.frameHeight = 2;
    this.frameWeight = 0;
    this.running = false;
    this.ready = false;
    this.time = 0;
    this.destroyed = false;
  }

  /* ─── Инициализация ─────────────────────────────────────────────────────── */

  async init() {
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lite ? 1.25 : 1.6));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    // На телефоне тени — самая дорогая часть кадра, а выигрыш наименее заметен.
    this.renderer.shadowMap.enabled = !this.lite;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(30, 1, 0.05, 60);
    this.camera.position.set(0, 0, 3);

    // Глянец корпуса держится на отражении студии — без окружения останется
    // только диффузная засветка, и блика по фаскам не будет.
    this.environment = createEnvironment(this.renderer);
    this.scene.environment = this.environment;
    this.lights = createLights(this.scene);

    this.#buildBackdrop();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const wordmarkTexture = await createWordmarkTexture();

    for (const [index, product] of this.products.entries()) {
      const screenTexture = await createScreenTexture(product.scene.screen, maxAnisotropy);
      this.#addProduct(product, screenTexture, wordmarkTexture);
      if (index === 0) {
        this.ready = true;
        this.resize();
        this.render();
      }
    }

    this.#buildFrames();
    this.resize();
    return this;
  }

  #buildBackdrop() {
    this.backdropMaterial = new ShaderMaterial({
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      depthWrite: false,
      uniforms: {
        uGlowPos: { value: new Vector2(0.62, 0.52) },
        uGlowColor: { value: new Vector3(0.05, 0.05, 0.048) },
        uGlow: { value: 1 },
        uAspect: { value: 1 },
      },
    });
    this.backdrop = new Mesh(new PlaneGeometry(1, 1), this.backdropMaterial);
    this.backdrop.position.z = -12;
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);
  }

  #addProduct(product, screenTexture, wordmarkTexture) {
    // Свой набор материалов на продукт: прозрачностью при переходе управляем
    // независимо, иначе уходящий корпус утащил бы за собой второй.
    const materials = createMaterials();
    const screenMaterial = createScreenMaterial(screenTexture);
    const wordmarkMaterial = createScreenMaterial(wordmarkTexture.clone());
    wordmarkMaterial.transparent = true;

    const build = BUILDERS[product.scene.model];
    const { root: model } = build(materials, screenMaterial, wordmarkMaterial);

    // Модель строится «стоящей на полу»; для кадра её удобнее центрировать.
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    model.position.sub(center);

    const pivot = new Group(); // сюда приходит вращение — корпус и экран заодно
    pivot.add(model);

    // Оборудование стоит на собственной тени, а не на подиуме: плоскость
    // невидима и ловит только тень, поэтому под машиной нет чужеродного диска.
    const floor = new Mesh(
      new PlaneGeometry(Math.max(size.x, size.z) * 6, Math.max(size.x, size.z) * 6),
      new ShadowMaterial({ opacity: 0.3, transparent: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -size.y / 2 - 0.001;
    floor.receiveShadow = !this.lite;
    pivot.add(floor);

    const root = new Group();
    root.add(pivot);
    this.scene.add(root);

    this.items.set(product.id, {
      product,
      root,
      pivot,
      model,
      floor,
      shellMaterials: Object.values(materials),
      screenMaterial,
      wordmarkMaterial,
      height: size.y,
      shadowsOn: true,
      current: state({ opacity: 0 }),
    });
  }

  /* ─── Кейфреймы ─────────────────────────────────────────────────────────── */

  /**
   * Раскладка истории: герой → главы первого продукта → передача плана →
   * главы второго → финал, в котором оборудование уходит вверх из кадра.
   *
   * У каждой главы два кейфрейма: приход (камера доезжает) и удержание
   * (кадр почти замирает). Вес удержания больше — прокрутки на него уходит
   * заметно больше, и текст успевают прочитать.
   */
  #buildFrames() {
    const ids = this.products.map((product) => product.id);
    const narrow = this.narrow;
    const tallest = Math.max(...[...this.items.values()].map((item) => item.height), 1);
    const hidden = (side) => state({ x: side * 1.7, fit: 0.34, opacity: 0, glow: 0 });

    const frames = [];

    // Герою нужен свой запас прокрутки: это первый экран, его читают дольше.
    // В кадре обе машины: POS ближе к колонке текста, киоск правее и выше.
    // Соотношение роста берём как корень из отношения высот — разница читается,
    // но компактный POS не превращается в мелочь рядом с киоском.
    // POS вчетверо ниже киоска (424 мм против 1536). Честная доля превратила бы
    // его в мелочь, поэтому разницу сжимаем степенью 0,45: рост читается, но
    // настольная касса остаётся видимой машиной, а не деталью у ножки.
    const heroBase = narrow ? 0.19 : 0.74;
    const heroFit = (product) =>
      heroBase * ((this.items.get(product.id)?.height ?? tallest) / tallest) ** 0.45;

    frames.push({
      weight: 2.8,
      key: 'hero',
      glow: [0.62, 0.46],
      items: Object.fromEntries(
        this.products.map((product, index) => {
          const fit = heroFit(product);
          const baseY = narrow ? 0.58 : -0.05;
          return [
            product.id,
            state({
              x: narrow ? 0 : index === 0 ? 0.24 : 0.68,
              xSpread: narrow ? (index === 0 ? -0.5 : 0.34) : 0,
              // В узком портретном кадре места по горизонтали нет, поэтому машины
              // расходятся по диагонали и не перекрывают друг друга.
              //
              // На широком кадре низ по общей линии прижимал компактный POS ко
              // дну экрана: он вчетверо ниже киоска. Поэтому POS стоит по
              // вертикальному центру кадра, киоск — на своей линии.
              y: narrow
                ? baseY + (index === 0 ? -0.02 : 0.08)
                : index === 0
                  ? 0.12
                  : baseY + 0.04,
              fit,
              yaw: index === 0 ? -0.12 : -0.24,
              pitch: 0.02,
              opacity: index === 0 ? 1 : narrow ? 0.9 : 1,
              glow: index === 0 ? 1 : 0.85,
            }),
          ];
        })
      ),
    });

    this.products.forEach((product, productIndex) => {
      product.chapters.forEach((chapter, chapterIndex) => {
        const camera = chapter.camera;

        const target = (over = {}) => {
          const items = {};
          ids.forEach((id, index) => {
            if (id === product.id) {
              items[id] = state({
                x: camera.x,
                y: camera.y + (narrow ? 0.3 : 0),
                fit: camera.zoom * (narrow ? 0.46 : 0.72) * (over.fitScale ?? 1),
                yaw: camera.tilt * 2.6 + (over.yaw ?? 0),
                pitch: camera.pitch ?? 0.02,
              });
            } else {
              items[id] = hidden(index < productIndex ? -1 : 1);
            }
          });
          return items;
        };

        // Приход: камера доехала, дальше начинается удержание.
        frames.push({
          weight: chapterIndex === 0 ? WEIGHT_HOLD * 1.1 : WEIGHT_HOLD,
          key: chapter.id,
          productId: product.id,
          role: 'enter',
          glow: [0.5 - camera.x * 0.2, 0.52 - camera.y * 0.18],
          items: target(),
        });

        // Конец удержания: кадр за это время едва дышал — доллинг на пару
        // процентов и микроповорот. Дальше идёт переход к следующей главе.
        frames.push({
          weight: WEIGHT_MOVE,
          key: `${chapter.id}-hold`,
          productId: product.id,
          role: 'hold',
          glow: [0.5 - camera.x * 0.2, 0.52 - camera.y * 0.18],
          items: target({ fitScale: 1.035, yaw: 0.025 }),
        });
      });

      // Передача плана следующему продукту: один уходит вглубь, другой выходит из неё.
      const next = this.products[productIndex + 1];
      if (next) {
        const items = {};
        ids.forEach((id, index) => {
          if (id === product.id) {
            items[id] = state({
              x: -1.1,
              y: 0.04,
              fit: 0.36,
              yaw: 0.36,
              opacity: 0.22,
              glow: 0.3,
            });
          } else if (id === next.id) {
            items[id] = state({
              x: 0.16,
              y: narrow ? 0.18 : 0.02,
              fit: narrow ? 0.34 : 0.56,
              yaw: -0.26,
              opacity: 0.85,
              glow: 0.7,
            });
          } else {
            items[id] = hidden(index < productIndex ? -1 : 1);
          }
        });

        frames.push({ weight: 0.9, key: `handoff-${product.id}`, glow: [0.5, 0.56], items });
      }
    });

    // Финал: оборудование собирается в кадре и уходит вверх, освобождая сайт.
    const outroItems = (over) =>
      Object.fromEntries(
        this.products.map((product, index) => {
          // Корень вместо прямого отношения: разница в росте остаётся честной,
          // но меньший продукт не превращается в точку на фоне киоска.
          const ratio = Math.sqrt((this.items.get(product.id)?.height ?? tallest) / tallest);
          const fit = over.fit * ratio;
          return [
          product.id,
          state({
            x: index === 0 ? -0.42 : 0.42,
            // Низ у обоих на одной линии: в общем кадре они стоят на одном полу.
            y: over.y + (fit - over.fit) / 2,
            fit,
            yaw: index === 0 ? 0.18 : -0.18,
            pitch: over.pitch ?? 0.02,
            opacity: over.opacity,
            glow: over.glow,
          }),
          ];
        })
      );

    frames.push({
      weight: 1,
      key: 'outro-hold',
      glow: [0.5, 0.48],
      items: outroItems({ y: -0.02, fit: narrow ? 0.3 : 0.62, opacity: 1, glow: 1 }),
    });

    frames.push({
      weight: 1.1,
      key: 'outro',
      glow: [0.5, 0.1],
      // Наезд, а не отъезд: машины уходят вверх мимо камеры и вырастают,
      // одновременно угасая. Уменьшение читалось бы как «их уносит вдаль».
      items: outroItems({ y: 1.05, fit: narrow ? 0.62 : 1.18, opacity: 0, glow: 0, pitch: -0.06 }),
    });

    const total = frames.reduce((sum, frame) => sum + frame.weight, 0);
    let acc = 0;
    frames.forEach((frame) => {
      frame.at = acc / total;
      acc += frame.weight;
    });
    frames[frames.length - 1].at = 1;

    this.frames = frames;
  }

  /**
   * Границы, по которым текстовый слой идёт в такт сцене: начало прихода,
   * конец удержания, а также конец героя и момент ухода оборудования.
   */
  getTimeline() {
    const chapters = [];
    this.frames.forEach((frame, index) => {
      if (frame.role !== 'enter') return;
      chapters.push({
        key: frame.key,
        productId: frame.productId,
        from: this.frames[index - 1]?.at ?? 0, // начало перехода к этой главе
        at: frame.at, // камера доехала, глава началась
        hold: this.frames[index + 1]?.at ?? frame.at, // конец удержания
        end: this.frames[index + 2]?.at ?? 1, // следующая глава на месте
      });
    });

    return {
      chapters,
      heroEnd: this.frames[1]?.at ?? 0.1,
      outroStart: this.frames.find((frame) => frame.key === 'outro-hold')?.at ?? 0.9,
    };
  }

  /* ─── Внешнее управление ────────────────────────────────────────────────── */

  setProgress(value) {
    this.progress = clamp(value, 0, 1);
  }

  setPointer(x, y) {
    this.pointerTarget.set(clamp(x, -1, 1), clamp(y, -1, 1));
  }

  /** Подсветка продукта при наведении на его кнопку в герое. */
  setHint(id) {
    this.hint = id;
  }

  resize() {
    if (!this.renderer) return;
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.tanHalfFov = Math.tan((this.camera.fov * Math.PI) / 360);

    this.backdrop.scale.set(60 * this.camera.aspect, 60, 1);
    this.backdropMaterial.uniforms.uAspect.value = this.camera.aspect;

    // На узком экране боковая композиция не работает: объект встаёт по центру.
    // Чем ближе кадр к квадрату, тем скромнее должен быть объект, иначе он
    // наезжает на текстовую колонку.
    this.layout = {
      xScale: clamp((this.camera.aspect - 0.62) / 0.85, 0.12, 1),
      fitScale: clamp(0.58 + this.camera.aspect * 0.24, 0.72, 1),
    };

    const narrow = this.camera.aspect < 0.95;
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      if (this.frames.length) this.#buildFrames();
    }

    this.render();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.frameId = requestAnimationFrame(loop);
      const delta = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.update(delta);
      this.render();
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  /* ─── Кадр ──────────────────────────────────────────────────────────────── */

  update(delta) {
    if (!this.ready || !this.frames.length) return;
    this.time += delta;

    // Курсор догоняет цель по экспоненте: в кадре не должно быть рывков.
    const follow = 1 - Math.exp(-delta * 3.2);
    this.pointer.lerp(this.pointerTarget, follow);

    const { before, after, t } = this.#segment(this.progress);
    const eased = easeInOut(t);

    // Подсказка героя: продукт, на кнопку которого навели, выходит вперёд,
    // остальные отступают в глубину — это и есть «выбор продукта» до клика.
    const follow6 = 1 - Math.exp(-delta * 6);
    for (const id of this.items.keys()) {
      const target = this.hint === id && this.progress < 0.05 ? 1 : 0;
      this.hintMix.set(id, lerp(this.hintMix.get(id), target, follow6));
    }
    let hintTotal = 0;
    for (const value of this.hintMix.values()) hintTotal += value;

    this.frameWeight = 0;

    for (const [id, item] of this.items) {
      const from = before.items[id];
      const to = after.items[id];
      if (!from || !to) continue;

      const current = item.current;
      for (const field of FIELDS) current[field] = lerp(from[field], to[field], eased);

      const hint = this.hintMix.get(id);
      this.#applyItem(item, current, hint, hintTotal - hint);
    }

    this.#applyCamera(before, after, eased);
  }

  #segment(progress) {
    const frames = this.frames;
    let index = 0;
    while (index < frames.length - 2 && progress > frames[index + 1].at) index += 1;
    const before = frames[index];
    const after = frames[index + 1] ?? frames[index];
    const span = Math.max(after.at - before.at, 1e-4);
    return { before, after, t: clamp((progress - before.at) / span, 0, 1) };
  }

  #applyItem(item, s, hint, otherHint = 0) {
    const { root, pivot } = item;

    // Доля кадра → расстояние до камеры. Приближение получается доллингом,
    // геометрия при этом не масштабируется.
    const fit = clamp(s.fit * this.layout.fitScale * (1 + hint * 0.25 - otherHint * 0.06), 0.04, 1.4);
    const distance = item.height / (2 * fit * this.tanHalfFov);
    const viewHeight = 2 * this.tanHalfFov * distance;
    const viewWidth = viewHeight * this.camera.aspect;

    // Масштаб кадра ведущего объекта: камера поднимается пропорционально ему,
    // иначе высокий киоск и компактный POS встают в кадре по-разному.
    const weight = clamp(s.opacity, 0, 1);
    if (weight > this.frameWeight) {
      this.frameWeight = weight;
      this.frameHeight = viewHeight;
    }

    const x =
      (s.x * this.layout.xScale + s.xSpread) * viewWidth * 0.5 -
      hint * viewWidth * 0.1 -
      otherHint * viewWidth * 0.03;
    const y = s.y * viewHeight * 0.5;

    root.position.set(x, y, this.camera.position.z - distance);

    // Угол = база от прокрутки + небольшое живое смещение от курсора.
    const idle = Math.sin(this.time * 0.4 + (item.product.index === '01' ? 0 : 1.7)) * 0.012;
    pivot.rotation.y = s.yaw + this.pointer.x * POINTER_YAW + idle;
    pivot.rotation.x = s.pitch - this.pointer.y * POINTER_PITCH;

    const opacity = clamp(s.opacity + hint * 0.6 - otherHint * 0.5, 0, 1);
    const transparent = opacity < 0.999;
    for (const material of item.shellMaterials) {
      material.opacity = opacity;
      material.transparent = transparent;
    }
    item.screenMaterial.opacity = opacity;
    item.screenMaterial.transparent = transparent;
    item.wordmarkMaterial.opacity = opacity * 0.85;
    item.floor.material.opacity = opacity * 0.3;

    root.visible = opacity > 0.01;

    // Тени переключаем по порогу, а не каждый кадр: обход сцены не бесплатный.
    const shadowsOn = opacity > 0.55 && !this.lite;
    if (shadowsOn !== item.shadowsOn) {
      item.shadowsOn = shadowsOn;
      item.model.traverse((node) => {
        if (node.isMesh) node.castShadow = shadowsOn;
      });
      item.floor.receiveShadow = shadowsOn;
    }
  }

  #applyCamera(before, after, t) {
    const glowX = lerp(before.glow[0], after.glow[0], t);
    const glowY = lerp(before.glow[1], after.glow[1], t);
    this.backdropMaterial.uniforms.uGlowPos.value.set(
      glowX + this.pointer.x * 0.02,
      glowY - this.pointer.y * 0.02
    );

    // Камера почти неподвижна: её микродвижение добавляет кадру воздуха,
    // а «приближение» делает доллинг самого объекта. Подъём и точка взгляда
    // заданы долями кадра, поэтому ракурс одинаков для машин разного роста.
    const frame = this.frameHeight || 2;
    this.camera.position.x = this.pointer.x * 0.02 * frame;
    this.camera.position.y = (this.pointer.y * 0.012 + 0.06) * frame;
    this.camera.lookAt(0, 0.045 * frame, this.camera.position.z - 2);
  }

  render() {
    if (!this.renderer || this.destroyed) return;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.destroyed = true;

    for (const item of this.items.values()) {
      item.model.traverse((node) => {
        if (node.isMesh) node.geometry?.dispose();
      });
      [...item.shellMaterials, item.screenMaterial, item.wordmarkMaterial].forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      item.floor.geometry.dispose();
      item.floor.material.dispose();
    }

    this.environment?.dispose();
    this.backdrop?.geometry.dispose();
    this.backdropMaterial?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.canvas.remove();
  }
}
