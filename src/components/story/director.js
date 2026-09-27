import { getLenis } from '../../lib/scroll.js';

/**
 * Режиссёр истории: колесо — команда «следующая сцена», а не ручка прогресса.
 *
 * Раньше прогресс сцены каждый кадр считался из `scrollY`: колесо через
 * инерцию Lenis напрямую вело каждый кадр 3D-анимации, и модель ощущалась
 * джойстиком — дёргалась в такт рывкам колеса и замирала посреди движения,
 * стоило его отпустить.
 *
 * Теперь у истории есть набор остановок. Жест колесом, клавиша или свайп
 * задают только направление; переход между остановками — отдельная анимация
 * фиксированной длительности со своим сглаживанием. Запущенный переход
 * доигрывает до конца сам, параллельно второй не стартует, а жест во второй
 * половине перехода встаёт в очередь из одного места.
 *
 * Прокрутка страницы при этом не пропадает: позиция окна идёт за переходом,
 * поэтому полоса прокрутки, закреплённый кадр и выход к секциям ниже работают
 * как прежде. Она лишь перестала быть источником прогресса.
 */

// Один переход между остановками. В режиме «меньше движения» длительность та
// же: переход запускает сам пользователь, это отклик, а не самостоятельное
// движение, и короткий рывок ощущался бы ровно той резкостью, от которой уходим.
const DURATION = 1.15; // с
const GESTURE_GAP = 170; // мс тишины колеса — значит, начался новый жест
const WHEEL_MIN = 4; // шум тачпада меньше этого не считается командой
const SWIPE_MIN = 42; // px

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Остановки по таймлайну сцены.
 *
 * У главы есть удержание — отрезок, на котором кадр стоит. Встаём в его
 * начало (`p`), а уходим вперёд с его конца (`leave`): иначе первая часть
 * перехода прошла бы по неподвижному кадру и ощущалась бы задержкой отклика.
 */
export function buildStations(timeline) {
  const stations = [{ p: 0 }];
  timeline.chapters.forEach((chapter) => {
    stations.push({ p: chapter.at, leave: chapter.hold, productId: chapter.productId });
  });
  stations.push({ p: timeline.outroStart });
  stations.push({ p: 1 });
  return stations;
}

export function createDirector({ stations, box, onProgress }) {
  const duration = DURATION;
  const storyEnd = () => box.top + box.total;
  const offsetOf = (p) => box.top + p * box.total;

  let index = 0;
  let progress = 0;
  let mode = 'story'; // story — у руля режиссёр; free — страница ниже истории
  let anim = null;
  let queued = 0;
  let lastWheel = 0;
  let gestureStepped = false;
  let externalSince = 0;

  const syncScroll = (y) => {
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };

  const setProgress = (value) => {
    progress = value;
    onProgress(progress);
  };

  const start = (target, time = duration) => {
    if (target === index || target < 0 || target >= stations.length) return false;
    const forward = target > index;
    const from = forward ? stations[index].leave ?? stations[index].p : stations[index].p;
    const to = forward ? stations[target].p : stations[target].leave ?? stations[target].p;
    anim = { from, to, target, elapsed: 0, time, settle: stations[target].p };
    index = target;
    mode = 'story';
    // Кадр на удержании неподвижен, так что перескок к его концу незаметен.
    setProgress(from);
    return true;
  };

  /** Шаг по команде. false — дальше остановок нет, жест отдаём странице. */
  const step = (direction) => {
    if (anim) {
      if (anim.elapsed / anim.time > 0.5) queued = direction;
      return true;
    }
    return start(index + direction);
  };

  const inStory = () => {
    const y = window.scrollY;
    return y >= box.top - 2 && y <= storyEnd() + 2;
  };

  const onWheel = (event) => {
    if (event.ctrlKey) return; // масштаб страницы
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (Math.abs(event.deltaX) > Math.abs(dy)) return;
    const direction = Math.sign(dy);
    if (!direction) return;

    const now = performance.now();
    const fresh = now - lastWheel > GESTURE_GAP;
    lastWheel = now;
    if (fresh) gestureStepped = false;

    // Возврат к истории снизу: жест, который завёл бы прокрутку внутрь неё,
    // останавливается ровно на её конце, дальше едем по остановкам.
    if (mode === 'free') {
      const lenis = getLenis();
      const target = (lenis ? lenis.targetScroll : window.scrollY) + dy;
      if (direction < 0 && target < storyEnd()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        mode = 'story';
        index = stations.length - 1;
        setProgress(1);
        syncScroll(storyEnd());
        gestureStepped = true;
      }
      return;
    }

    if (!inStory()) return;

    // Выход за края истории: жест отдаём обычной прокрутке страницы.
    const atEdge = !anim && ((direction > 0 && index === stations.length - 1) || (direction < 0 && index === 0));
    if (atEdge) {
      if (direction > 0) mode = 'free';
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (Math.abs(dy) < WHEEL_MIN && !anim) return;

    // Один жест — один шаг. Хвост инерции тачпада после перехода — это тот же
    // жест, и повторно он сцену не двигает.
    if (anim) {
      if (fresh) step(direction);
      return;
    }
    if (gestureStepped) return;
    gestureStepped = step(direction);
  };

  const onKey = (event) => {
    if (mode !== 'story' || !inStory()) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
    const forward = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey);
    const back = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    if (!forward && !back) return;
    const direction = forward ? 1 : -1;
    if (!anim && ((direction > 0 && index === stations.length - 1) || (direction < 0 && index === 0))) {
      if (direction > 0) mode = 'free';
      return;
    }
    event.preventDefault();
    step(direction);
  };

  let touchY = null;
  const onTouchStart = (event) => {
    touchY = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (event) => {
    if (mode !== 'story' || !inStory() || touchY == null) return;
    const dy = touchY - (event.touches[0]?.clientY ?? touchY);
    const direction = Math.sign(dy);
    const atEdge = !anim && ((direction > 0 && index === stations.length - 1) || (direction < 0 && index === 0));
    if (atEdge) return;
    event.preventDefault();
  };
  const onTouchEnd = (event) => {
    if (touchY == null) return;
    const dy = touchY - (event.changedTouches[0]?.clientY ?? touchY);
    touchY = null;
    if (Math.abs(dy) < SWIPE_MIN || mode !== 'story' || !inStory()) return;
    const direction = Math.sign(dy);
    if (!anim && direction > 0 && index === stations.length - 1) {
      mode = 'free';
      return;
    }
    step(direction);
  };

  /** Ближайшая остановка к прогрессу — для прыжков полосой и якорями. */
  const nearest = (p) => {
    let best = 0;
    stations.forEach((station, i) => {
      if (Math.abs(station.p - p) < Math.abs(stations[best].p - p)) best = i;
    });
    return best;
  };

  const tick = (delta) => {
    if (anim) {
      anim.elapsed = Math.min(anim.elapsed + delta, anim.time);
      const t = easeInOutCubic(anim.elapsed / anim.time);
      const value = anim.from + (anim.to - anim.from) * t;
      setProgress(value);
      syncScroll(offsetOf(value));
      if (anim.elapsed >= anim.time) {
        setProgress(anim.settle);
        syncScroll(offsetOf(anim.settle));
        anim = null;
        if (queued) {
          const direction = queued;
          queued = 0;
          start(index + direction);
        }
      }
      return;
    }

    const y = window.scrollY;

    if (mode === 'free') {
      if (y >= storyEnd() - 2) {
        if (progress !== 1) setProgress(1);
        return;
      }
      // Попали внутрь истории не колесом (полоса, клавиши браузера, якорь).
      mode = 'story';
      externalSince = performance.now();
    }

    // Окно ушло от остановки чем-то внешним: полосой прокрутки, якорем,
    // поиском по странице. Пока движение идёт, кадр честно следует за
    // позицией, а когда оно стихло — доезжаем до ближайшей остановки.
    const expected = offsetOf(stations[index].p);
    if (Math.abs(y - expected) > 6) {
      const now = performance.now();
      const live = clamp((y - box.top) / box.total, 0, 1);
      if (Math.abs(live - progress) > 1e-4) {
        externalSince = now;
        setProgress(live);
      }
      if (now - externalSince > 180) {
        const target = nearest(live);
        index = target;
        anim = { from: live, to: stations[target].p, target, elapsed: 0, time: 0.45, settle: stations[target].p };
      }
    }
  };

  /** Переход к остановке по кнопке, одной анимацией. */
  const goTo = (target) => {
    if (anim) return;
    start(target, Math.max(duration, 1.35));
  };

  /** После ресайза позиции остановок в пикселях сдвинулись — встаём на свою. */
  const resync = () => {
    if (mode === 'story' && !anim) syncScroll(offsetOf(stations[index].p));
  };

  const listen = { passive: false, capture: true };
  window.addEventListener('wheel', onWheel, listen);
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, listen);
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  // Старт: встаём на остановку, ближайшую к текущей позиции (перезагрузка
  // посреди истории, переход по ссылке с якорем).
  const startY = window.scrollY;
  if (startY >= storyEnd()) {
    mode = 'free';
    index = stations.length - 1;
    setProgress(1);
  } else {
    index = nearest(clamp((startY - box.top) / box.total, 0, 1));
    setProgress(stations[index].p);
    syncScroll(offsetOf(stations[index].p));
  }

  return {
    get state() {
      return { index, progress, mode, busy: !!anim, queued };
    },
    tick,
    goTo,
    resync,
    stationOf: (productId) => stations.findIndex((station) => station.productId === productId),
    dispose() {
      window.removeEventListener('wheel', onWheel, listen);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove, listen);
      window.removeEventListener('touchend', onTouchEnd);
    },
  };
}
