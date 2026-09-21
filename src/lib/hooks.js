import { useEffect, useRef, useState } from 'react';

/**
 * Появление блоков при прокрутке через IntersectionObserver: наблюдатель
 * срабатывает один раз на элемент и не трогает состояние React.
 * Достаточно повесить className="reveal" на потомков контейнера.
 */
export function useReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const targets = root.classList.contains('reveal')
      ? [root, ...root.querySelectorAll('.reveal')]
      : [...root.querySelectorAll('.reveal')];
    if (!targets.length) return undefined;

    if (document.documentElement.dataset.motion === 'reduced') {
      targets.forEach((node) => node.classList.add('is-in'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: options.rootMargin ?? '0px 0px -12% 0px', threshold: options.threshold ?? 0.12 }
    );

    targets.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold]);

  return ref;
}

/** Медиазапрос как состояние — для решений «десктоп/мобильный», а не для анимаций. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Курсор-указатель: на тач-устройствах кастомный курсор не нужен. */
export const useHasPointer = () => useMediaQuery('(hover: hover) and (pointer: fine)');
