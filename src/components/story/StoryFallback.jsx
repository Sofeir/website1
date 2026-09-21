import { Link } from 'react-router-dom';
import { products } from '../../data/products.js';
import './fallback.css';

/**
 * Версия продуктовой истории без движения.
 *
 * Включается при prefers-reduced-motion: сцена, параллакс и управление
 * прокруткой отключены полностью, содержание остаётся тем же — те же главы,
 * те же изображения оборудования, обычная вертикальная страница.
 */
export default function StoryFallback() {
  return (
    <section className="flow" id="products" aria-label="Продукты ASOFT">
      <div className="shell flow__hero">
        <p className="kicker">Оборудование · ПО · Внедрение · Поддержка</p>
        <h1 className="display">
          Касса — это система,
          <br />
          <span className="h-dim">а не коробка.</span>
        </h1>
        <p className="lead">
          Оборудование, программное обеспечение и сопровождение собираются в одно решение — и
          отвечают за результат вместе, а не по отдельности.
        </p>
      </div>

      {products.map((product) => (
        <article key={product.id} className="shell flow__product">
          <header className="flow__head">
            <p className="kicker">Продукт {product.index}</p>
            <h2 className="h1">{product.name}</h2>
            <p className="lead">{product.summary}</p>
            <Link to={product.route} className="flow__link">
              Подробнее <span aria-hidden="true">↗</span>
            </Link>
          </header>

          <img
            className="flow__image"
            src={product.scene.still}
            alt={`${product.name} ASOFT`}
            loading="lazy"
            decoding="async"
          />

          <ol className="flow__list">
            {product.chapters.map((chapter) => (
              <li key={chapter.id}>
                <span className="mono flow__index">{chapter.label}</span>
                <h3 className="h3">{chapter.title.replace('\n', ' ')}</h3>
                <p className="text-dim">{chapter.text}</p>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}
