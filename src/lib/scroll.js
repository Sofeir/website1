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
 * Системная настройка «меньше движения» с явным переопределением.
 *
 * `?motion=full` и `?motion=reduced` запоминаются на время сессии: это нужно
 * и для проверки обеих версий сайта, и как выход для пользователя, у которого
 * настройка включена системой, а посмотреть сцену он всё-таки хочет.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;

  const override = new URLSearchParams(window.location.search).get('motion');
  if (override === 'full' || override === 'reduced') {
    try {
      window.sessionStorage.setItem('asoft:motion', override);
    } catch {
      // приватный режим — переопределение живёт только на этой странице
    }
    return override === 'reduced';
  }

  let stored = null;
  try {
    stored = window.sessionStorage.getItem('asoft:motion');
  } catch {
    stored = null;
  }
  if (stored === 'full' || stored === 'reduced') return stored === 'reduced';

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return null;

  lenis = new Lenis({
    duration: 2.4,
    easing: (t) => 1 - Math.pow(1 - t, 4),
    smoothWheel: true,
    // Колесо у разных мышей даёт разный delta; множитель ниже единицы
    // выравнивает шаг и не даёт одним движением перескочить сцену.
    wheelMultiplier: 0.3,
    touchMultiplier: 1.4,
  });

  const loop = (time) => {
    lenis.raf(time);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  if (import.meta.env.DEV) window.__lenis = lenis;

  return lenis;
}

export function stopSmoothScroll() {
  if (frame) cancelAnimationFrame(frame);
  lenis?.destroy();
  lenis = null;
  frame = null;
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
