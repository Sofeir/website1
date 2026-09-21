import { software } from '../../data/content.js';
import { useReveal } from '../../lib/hooks.js';
import ArrowLink from '../ui/ArrowLink.jsx';
import SectionHead from '../ui/SectionHead.jsx';
import SoftwareMock from './SoftwareMock.jsx';

/**
 * Раздел программного обеспечения.
 *
 * Поле `screenshot` у приложения имеет приоритет над макетом: когда появятся
 * реальные снимки экрана, раздел подхватит их без изменений в разметке.
 */
export default function Software() {
  const ref = useReveal();

  return (
    <section className="section section--raise" id="software" ref={ref}>
      <div className="shell">
        <SectionHead index="03" kicker={software.kicker} title={software.title} lead={software.lead} />

        <div className="software">
          {software.apps.map((app) => (
            <article key={app.id} className="software__app reveal">
              <div className="software__screen">
                {app.screenshot ? (
                  <img src={app.screenshot} alt={`Интерфейс ${app.name}`} loading="lazy" decoding="async" />
                ) : (
                  <>
                    <SoftwareMock kind={app.mock} />
                    <p className="software__note mono">Макет интерфейса</p>
                  </>
                )}
              </div>

              <div className="software__meta">
                <p className="mono software__sub">{app.subtitle}</p>
                <h3 className="h3">{app.name}</h3>
                <p className="card__text">{app.text}</p>
                <ArrowLink to={app.cta.href}>{app.cta.label}</ArrowLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
