import { formatPrice, pricing } from '../../data/site.js';
import { useReveal } from '../../lib/hooks.js';
import ArrowLink from '../ui/ArrowLink.jsx';
import SectionHead from '../ui/SectionHead.jsx';

/**
 * Ориентиры по стоимости. Осознанно без «пакетов» и без итоговой цены:
 * суммы берутся из data/site.js и помечены как ориентировочные.
 */
export default function Pricing() {
  const ref = useReveal();

  return (
    <section className="section" id="pricing" ref={ref}>
      <div className="shell">
        <SectionHead
          index="07"
          kicker="Стоимость"
          title={'Ориентиры\nпо бюджету'}
          lead={pricing.disclaimer}
        />

        <ul className="pricing">
          {pricing.items.map((item) => (
            <li key={item.id} className="price reveal">
              <div className="price__head">
                <h3 className="price__title">{item.title}</h3>
                <p className="card__text">{item.note}</p>
              </div>
              <div className="price__value">
                <span className="price__from mono">от</span>
                <span className="price__amount">
                  {formatPrice(item.from)} {pricing.currency}
                </span>
                <span className="price__unit mono">{item.unit}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="pricing__foot reveal">
          <p className="card__text">
            Точная стоимость рассчитывается по конфигурации: количество рабочих мест, состав
            периферии, объём интеграции и выбранный уровень обслуживания.
          </p>
          <ArrowLink to="/#contact">Запросить расчёт</ArrowLink>
        </div>
      </div>
    </section>
  );
}
