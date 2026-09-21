import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { products, storyChapters } from '../../data/products.js';
import { prefersReducedMotion, scrollTo } from '../../lib/scroll.js';
import StoryFallback from './StoryFallback.jsx';
import './story.css';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-4), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Интерактивная продуктовая история.
 *
 * Одна закреплённая сцена на всю главу сайта: прокрутка не перелистывает
 * секции, а ведёт единый план — оборудование остаётся в кадре, меняются
 * камера, свет и текстовый слой. Весь кадр считается в rAF и пишется прямо
 * в стиль узлов: React здесь монтирует разметку и больше не участвует.
 */
export default function ProductStory() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const railRef = useRef(null);
  const railFillRef = useRef(null);
  const outroRef = useRef(null);
  const chapterRefs = useRef([]);
  const markRefs = useRef([]);
  const stageRef = useRef(null);
  const timelineRef = useRef(null);

  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const lite = window.matchMedia('(max-width: 820px)').matches;

    let stage = null;
    let frame = 0;
    let disposed = false;
    let visible = true;

    /** Раскладка текстового слоя по тому же прогрессу, что ведёт сцену. */
    const paint = (progress) => {
      const timeline = timelineRef.current;
      if (!timeline) return;

      const { chapters, heroEnd, outroStart } = timeline;

      const hero = heroRef.current;
      if (hero) {
        const k = clamp(progress / (heroEnd * 0.62), 0, 1);
        hero.style.opacity = String(1 - k);
        hero.style.transform = `translate3d(0, ${-k * 60}px, 0)`;
        hero.style.pointerEvents = k > 0.2 ? 'none' : 'auto';
        // Ушедший герой не должен ловить фокус с клавиатуры.
        hero.style.visibility = k > 0.99 ? 'hidden' : 'visible';
      }

      chapters.forEach((chapter, index) => {
        const node = chapterRefs.current[index];
        if (!node) return;

        // Текст выходит в конце подъезда камеры, держится всё удержание целиком
        // и уходит только когда начался следующий переход.
        const { from, at, hold, end } = chapter;
        const appear = smoothstep(from + (at - from) * 0.45, at, progress);
        const leave = 1 - smoothstep(hold, hold + (end - hold) * 0.55, progress);
        const value = appear * leave;
        const direction = progress < hold ? 1 : -1;

        node.style.opacity = String(value);
        node.style.transform = `translate3d(0, ${(1 - value) * 26 * direction}px, 0)`;

        const mark = markRefs.current[index];
        if (mark) mark.classList.toggle('is-active', progress >= from + (at - from) * 0.5 && progress < end);
      });

      const fill = railFillRef.current;
      if (fill) fill.style.transform = `scaleY(${clamp(progress, 0, 1)})`;

      // В герое глав ещё нет — индикатор появляется вместе с первой из них.
      const rail = railRef.current;
      if (rail) rail.style.opacity = String(smoothstep(heroEnd * 0.45, heroEnd * 0.9, progress));

      const outro = outroRef.current;
      if (outro) {
        const k = smoothstep(outroStart + 0.02, 0.99, progress);
        outro.style.opacity = String(k);
        outro.style.transform = `translate3d(0, ${(1 - k) * 24}px, 0)`;
        outro.style.pointerEvents = k > 0.6 ? 'auto' : 'none';
        outro.style.visibility = k < 0.01 ? 'hidden' : 'visible';
      }
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      const rect = wrap.getBoundingClientRect();
      const total = Math.max(wrap.offsetHeight - window.innerHeight, 1);
      const progress = clamp(-rect.top / total, 0, 1);
      stage?.setProgress(progress);
      paint(progress);
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      stage?.setPointer(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );
    };

    const onResize = () => stage?.resize();

    // Сцена считается только пока она в кадре: ниже по странице GPU свободен.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) stage?.start();
        else stage?.stop();
      },
      { threshold: 0 }
    );

    // three подтягиваем отдельным чанком: он нужен только здесь и только тогда,
    // когда сцена действительно будет показана.
    import('../../webgl/ProductStage.js')
      .then(async ({ ProductStage }) => {
        if (disposed) return;
        stage = new ProductStage(canvas, { products, lite });
        stageRef.current = stage;
        // Ручка для отладки сцены в дев-сборке: кадр удобнее проверять из консоли.
        if (import.meta.env.DEV) window.__stage = stage;

        await stage.init();
        if (disposed) {
          stage.dispose();
          return;
        }

        timelineRef.current = stage.getTimeline();
        wrap.classList.add('is-ready');
        stage.resize();
        stage.start();
        observer.observe(wrap);
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('resize', onResize);
        frame = requestAnimationFrame(tick);
      })
      .catch((error) => console.error('[asoft] сцена не запустилась', error));

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      stage?.dispose();
      stageRef.current = null;
    };
  }, [reduced]);

  /** Выбор продукта в герое — переход к его главе внутри той же сцены. */
  const goToProduct = (productId) => {
    const wrap = wrapRef.current;
    const timeline = timelineRef.current;
    if (!wrap || !timeline) return;
    const mark = timeline.chapters.find((chapter) => chapter.productId === productId);
    if (!mark) return;
    const total = wrap.offsetHeight - window.innerHeight;
    scrollTo(wrap.offsetTop + total * mark.at, { duration: 1.6 });
  };

  if (reduced) return <StoryFallback />;

  return (
    <section
      ref={wrapRef}
      className="story"
      id="products"
      aria-label="Продукты ASOFT в интерактивной сцене"
    >
      <div className="story__viewport">
        <div
          ref={canvasRef}
          className="story__canvas"
          data-cursor="stage"
          data-cursor-label="Explore"
          aria-hidden="true"
        />

        <div className="story__overlay">
          <div className="story__hero" ref={heroRef}>
            <div className="story__herotext">
              <p className="kicker story__eyebrow">Оборудование · ПО · Внедрение · Поддержка</p>
              <h1 className="display story__title">
                Касса — это система,
                <br />
                <span className="h-dim">а не коробка.</span>
              </h1>
              <p className="lead story__lead">
                Оборудование, программное обеспечение и сопровождение собираются в одно решение —
                и отвечают за результат вместе, а не по отдельности.
              </p>

              <div className="story__choice">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="choice"
                    data-cursor="link"
                    onClick={() => goToProduct(product.id)}
                    onMouseEnter={() => stageRef.current?.setHint(product.id)}
                    onMouseLeave={() => stageRef.current?.setHint(null)}
                    onFocus={() => stageRef.current?.setHint(product.id)}
                    onBlur={() => stageRef.current?.setHint(null)}
                  >
                    <span className="choice__index mono">{product.index}</span>
                    <span className="choice__body">
                      <span className="choice__name">{product.name}</span>
                      <span className="choice__note">{product.kicker}</span>
                    </span>
                    <span className="choice__arrow" aria-hidden="true">
                      ↓
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p className="story__scrollhint mono" aria-hidden="true">
              Листайте — сцена управляется прокруткой
            </p>
          </div>

          <div className="story__chapters">
            {storyChapters.map((chapter, index) => (
              <article
                key={chapter.id}
                ref={(node) => {
                  chapterRefs.current[index] = node;
                }}
                className="chapter"
                data-side={chapter.camera.x >= 0 ? 'left' : 'right'}
                style={{ opacity: 0 }}
              >
                <p className="chapter__meta mono">
                  <span className="chapter__dot" aria-hidden="true" />
                  {products.find((product) => product.id === chapter.productId)?.name}
                </p>
                <p className="chapter__index">{chapter.label}</p>
                <h2 className="chapter__title">
                  {chapter.title.split('\n').map((line, i) => (
                    <span key={line} className={i === 1 ? 'h-dim' : undefined}>
                      {line}
                      <br />
                    </span>
                  ))}
                </h2>
                <p className="chapter__text">{chapter.text}</p>
              </article>
            ))}
          </div>

          <div className="story__rail" aria-hidden="true" ref={railRef} style={{ opacity: 0 }}>
            <div className="story__railtrack">
              <div className="story__railfill" ref={railFillRef} />
            </div>
            <ul className="story__marks">
              {storyChapters.map((chapter, index) => (
                <li
                  key={chapter.id}
                  ref={(node) => {
                    markRefs.current[index] = node;
                  }}
                  className="story__mark mono"
                  data-product={chapter.productId}
                >
                  {chapter.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="story__outro" ref={outroRef} style={{ opacity: 0 }}>
            <p className="kicker">Дальше</p>
            <p className="story__outrotext">
              Два продукта — одна система. Ниже: программное обеспечение, внедрение и сервис.
            </p>
            <div className="story__outrolinks">
              {products.map((product) => (
                <Link key={product.id} to={product.route} className="story__outrolink" data-cursor="link">
                  {product.name}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
