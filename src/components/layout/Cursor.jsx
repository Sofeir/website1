import { useEffect, useRef } from 'react';
import { useHasPointer } from '../../lib/hooks.js';
import './cursor.css';

/**
 * Курсор-кольцо. Нужен ровно за одним: показать, что сцена с оборудованием
 * реагирует на указатель. Над обычным контентом он остаётся точкой,
 * над интерактивной сценой — раскрывается в подпись.
 * На тач-устройствах не монтируется вовсе.
 */
export default function Cursor() {
  const hasPointer = useHasPointer();
  const ref = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    if (!hasPointer) return undefined;
    const node = ref.current;
    const label = labelRef.current;
    if (!node) return undefined;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { ...pos };
    let frame = 0;
    let visible = false;

    const onMove = (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!visible) {
        visible = true;
        node.classList.add('is-visible');
      }

      const hit = event.target instanceof Element ? event.target.closest('[data-cursor]') : null;
      const mode = hit?.getAttribute('data-cursor') ?? '';
      node.dataset.mode = mode;
      if (label) label.textContent = hit?.getAttribute('data-cursor-label') ?? '';
    };

    const onLeave = () => {
      visible = false;
      node.classList.remove('is-visible');
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      node.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    frame = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
    };
  }, [hasPointer]);

  if (!hasPointer) return null;

  return (
    <div className="cursor" ref={ref} aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__label" ref={labelRef} />
    </div>
  );
}
