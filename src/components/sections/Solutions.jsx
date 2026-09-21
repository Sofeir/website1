import { Link } from 'react-router-dom';
import { products } from '../../data/products.js';
import { useReveal } from '../../lib/hooks.js';
import SectionHead from '../ui/SectionHead.jsx';

/**
 * Витрина решений. Изображения те же, что в сцене, — оборудование на сайте
 * везде одно и то же, без вариантов «для каталога».
 */
export default function Solutions() {
  const ref = useReveal();

  return (
    <section className="section" id="solutions" ref={ref}>
      <div className="shell">
        <SectionHead
          index="02"
          kicker="Решения"
          title={'Два продукта,\nодна система'}
          lead="Кассовая зона и зона самообслуживания работают с одной номенклатурой, одними правилами и одной отчётностью."
        />

        <div className="solutions">
          {products.map((product) => (
            <Link
              key={product.id}
              to={product.route}
              className="solution reveal"
              data-cursor="link"
            >
              <div className="solution__media">
                <img
                  src={product.scene.still}
                  alt={`${product.name} ASOFT`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="solution__body">
                <p className="mono solution__index">Продукт {product.index}</p>
                <h3 className="h3 solution__title">{product.name}</h3>
                <p className="solution__text">{product.summary}</p>
                <span className="solution__more">
                  Подробнее <span aria-hidden="true">↗</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
