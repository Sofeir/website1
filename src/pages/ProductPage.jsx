import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getProduct, products } from '../data/products.js';
import { software } from '../data/content.js';
import { pricing, formatPrice } from '../data/site.js';
import { useReveal } from '../lib/hooks.js';
import ArrowLink from '../components/ui/ArrowLink.jsx';
import SoftwareMock from '../components/sections/SoftwareMock.jsx';
import Contact from '../components/sections/Contact.jsx';
import '../components/ui/ui.css';
import '../components/sections/sections.css';
import './product-page.css';

/**
 * Страница продукта.
 *
 * Обе страницы — один компонент на конфигурации из data/products.js:
 * оборудование, программное обеспечение, функции, сценарии, интеграция и сервис.
 * Содержимое дополняется в конфигурации, структура остаётся прежней.
 */
export default function ProductPage() {
  const { productId } = useParams();
  const product = getProduct(productId);
  const ref = useReveal();

  useEffect(() => {
    if (!product) return undefined;
    const previous = document.title;
    document.title = `${product.name} — ASOFT`;
    return () => {
      document.title = previous;
    };
  }, [product]);

  if (!product) return <Navigate to="/" replace />;

  const app = software.apps.find((item) => item.id === product.id);
  const other = products.find((item) => item.id !== product.id);
  const related = pricing.items.filter((item) => item.id.startsWith(product.id === 'pos' ? 'pos' : 'sco'));

  return (
    <article className="product" ref={ref}>
      <header className="product__hero">
        <div className="shell product__heroinner">
          <div className="product__herotext">
            <p className="kicker product__crumbs">
              <Link to="/" data-cursor="link">
                ASOFT
              </Link>
              <span aria-hidden="true">/</span>
              <span>Продукт {product.index}</span>
            </p>
            <h1 className="h1">
              {product.page.hero.split('\n').map((line, index) => (
                <span key={line} className={index > 0 ? 'h-dim' : undefined}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>
            <p className="lead">{product.page.lead}</p>
            <div className="product__actions">
              <ArrowLink to="/#contact" variant="solid">
                Обсудить проект
              </ArrowLink>
              <ArrowLink to="/#pricing">Стоимость</ArrowLink>
            </div>
          </div>

          <div className="product__heromedia">
            <img
              src={product.scene.still}
              alt={`${product.name} ASOFT`}
              width="1120"
              height="1104"
              decoding="async"
            />
          </div>
        </div>
      </header>

      <section className="section product__section" aria-labelledby="specs-title">
        <div className="shell product__split">
          <div className="product__sticky">
            <h2 className="h2 reveal" id="specs-title">
              Оборудование
            </h2>
            <p className="card__text reveal">
              Конфигурация подбирается под точку: состав периферии и размещение уточняются на
              этапе обследования.
            </p>
          </div>

          <dl className="speclist reveal">
            {product.page.specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section product__section product__section--raise" id="software" aria-labelledby="software-title">
        <div className="shell">
          <div className="product__softwarehead">
            <h2 className="h2 reveal" id="software-title">
              Программное обеспечение
            </h2>
            <p className="lead reveal">{app?.text}</p>
          </div>

          <div className="product__software reveal">
            {app?.screenshot ? (
              <img src={app.screenshot} alt={`Интерфейс ${app.name}`} loading="lazy" decoding="async" />
            ) : (
              <>
                <SoftwareMock kind={app?.mock} />
                <p className="software__note mono">Макет интерфейса</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section product__section" aria-labelledby="features-title">
        <div className="shell">
          <h2 className="h2 reveal" id="features-title">
            Функции
          </h2>
          <div className="product__features">
            {product.page.features.map((feature, index) => (
              <article
                key={feature.title}
                className="card reveal"
                style={{ '--reveal-delay': `${(index % 3) * 70}ms` }}
              >
                <p className="card__index">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="card__title">{feature.title}</h3>
                <p className="card__text">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section product__section" aria-labelledby="scenarios-title">
        <div className="shell">
          <h2 className="h2 reveal" id="scenarios-title">
            Сценарии использования
          </h2>
          <ul className="product__scenarios">
            {product.page.scenarios.map((scenario) => (
              <li key={scenario.title} className="reveal">
                <h3 className="card__title">{scenario.title}</h3>
                <p className="card__text">{scenario.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section product__section product__section--raise" aria-labelledby="service-title">
        <div className="shell product__split">
          <div className="product__sticky">
            <h2 className="h2 reveal" id="service-title">
              Внедрение
              <br />
              <span className="h-dim">и обслуживание</span>
            </h2>
          </div>
          <div className="product__service">
            <p className="card__text reveal">
              Настройка, интеграция с учётной системой, перенос номенклатуры, монтаж и обучение
              персонала выполняются одной командой. После запуска остаются регламентные работы,
              обновления и приём обращений.
            </p>
            <ul className="speclist reveal">
              {related.map((item) => (
                <li key={item.id}>
                  <span className="speclist__label">{item.title}</span>
                  <span>
                    от {formatPrice(item.from)} {pricing.currency} · {item.unit}
                  </span>
                </li>
              ))}
            </ul>
            <p className="product__disclaimer mono">{pricing.disclaimer}</p>
          </div>
        </div>
      </section>

      {other && (
        <section className="section product__next" aria-label="Другой продукт">
          <Link to={other.route} className="shell product__nextlink" data-cursor="link">
            <span className="kicker">Следующий продукт</span>
            <span className="h2">{other.name}</span>
            <span className="product__nextarrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </section>
      )}

      <Contact />
    </article>
  );
}
