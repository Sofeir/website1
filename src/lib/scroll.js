import Lenis from 'lenis';

/**
 * Единственный экземпляр плавной прокрутки на приложение.
 *
 * Держим его вне React: сцена и секции читают позицию прокрутки в своём кадре
 * rAF, и ни один пиксель скролла не должен доходить до перерисовки дерева.
 * При включённом prefers-reduced-motion остаётся нативная прокрутка.
 */

let lenis = null;
let frame = null;

/**
 * Выбор пользователя по режиму движения: 'full' | 'reduced' | null.
 *
 * `null` значит «следуем системе». Выбор хранится в localStorage, а не в
 * sessionStorage: если человек один раз включил полную версию, повторять это
 * на каждый визит он не должен.
 */
const MOTION_KEY = 'asoft:motion';

function readStored() {
  try {
    const value = window.localStorage.getItem(MOTION_KEY);
    return value === 'full' || value === 'reduced' ? value : null;
  } catch {
    return null;
  }
}

export function motionPreference() {
  if (typeof window === 'undefined') return null;

  // `?motion=full` и `?motion=reduced` задают режим ссылкой и запоминаются.
  const override = new URLSearchParams(window.location.search).get('motion');
  if (override === 'full' || override === 'reduced') {
    try {
      window.localStorage.setItem(MOTION_KEY, override);
    } catch {
      // приватный режим — переопределение живёт только на этой странице
    }
    return override;
  }

  return readStored();
}

/**
 * Показывать ли версию без движения.
 *
 * По умолчанию слушаем системную настройку. Но она приходит не только от
 * человека: Яндекс Браузер включает её в режиме энергосбережения, и сайт молча
 * падал в статичную вёрстку. Поэтому выбор пользователя её перекрывает —
 * см. переключатель в подвале и кнопку в версии без движения.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;

  const choice = motionPreference();
  if (choice) return choice === 'reduced';

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Переключение режима. Перезагружаем страницу: от режима зависит, собирается
 * ли сцена вообще, и половинчатое переключение на лету дало бы мусорное
 * промежуточное состояние.
 */
export function setMotionPreference(value) {
  try {
    if (value === 'full' || value === 'reduced') window.localStorage.setItem(MOTION_KEY, value);
    else window.localStorage.removeItem(MOTION_KEY);
  } catch {
    // без хранилища переключение сработает только на этой странице
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('motion');
  window.location.replace(url.toString());
}

/**
 * Единственный тикер на страницу.
 *
 * Раньше кадр вели три независимых цикла requestAnimationFrame: инерция
 * прокрутки, текстовый слой истории и рендер сцены. Каждый просил у браузера
 * свой колбэк и имел своё представление о времени. Теперь цикл один: он
 * двигает Lenis и затем по порядку вызывает подписчиков — у всех одна и та же
 * отметка времени и гарантированный порядок «сначала прокрутка, потом кадр».
 */
const listeners = new Set();

export function onTick(fn) {
  listeners.add(fn);
  startTicker();
  return () => listeners.delete(fn);
}

function startTicker() {
  if (frame) return;
  let last = performance.now();
  const loop = (time) => {
    frame = requestAnimationFrame(loop);
    lenis?.raf(time);
    const delta = Math.min((time - last) / 1000, 0.1);
    last = time;
    for (const fn of listeners) fn(delta, time);
  };
  frame = requestAnimationFrame(loop);
}

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return null;

  lenis = new Lenis({
    // Режим lerp, а не duration: позиция на каждом кадре подтягивается к цели
    // на фиксированную долю, и прокрутка всё время догоняет колесо. Прежний
    // duration с кубическим выходом давал тяжёлый разгон и ощущался
    // запаздыванием. Вне секции истории именно эта инерция и рулит прокруткой —
    // внутри неё позицию ведёт director.js через lenis.scrollTo(immediate).
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
  });

  startTicker();

  if (import.meta.env.DEV) window.__lenis = lenis;

  return lenis;
}

export function stopSmoothScroll() {
  lenis?.destroy();
  lenis = null;
  if (!listeners.size && frame) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.2, ...options });
    return;
  }
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
  } else if (target) {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    node?.scrollIntoView({ behavior, block: 'start' });
  }
}

export const getLenis = () => lenis;
