import { advantages, services, supportBlock } from '../../data/content.js';
import { useReveal } from '../../lib/hooks.js';
import SectionHead from '../ui/SectionHead.jsx';

export function Services() {
  const ref = useReveal();

  return (
    <section className="section" id="services" ref={ref}>
      <div className="shell">
        <SectionHead
          index="04"
          kicker="Услуги"
          title={'От поставки\nдо сопровождения'}
          lead="Семь направлений, которые закрывают весь путь: подобрать, настроить, запустить и поддерживать."
        />

        <div className="services">
          {services.map((service, index) => (
            <article
              key={service.id}
              className="card reveal"
              style={{ '--reveal-delay': `${(index % 3) * 70}ms` }}
            >
              <p className="card__index">{service.index}</p>
              <h3 className="card__title">{service.title}</h3>
              <p className="card__text">{service.text}</p>
              <div className="tags">
                {service.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Support() {
  const ref = useReveal();

  return (
    <section className="section section--raise" id="support" ref={ref}>
      <div className="shell">
        <SectionHead
          index="05"
          kicker={supportBlock.kicker}
          title={supportBlock.title}
          lead={supportBlock.lead}
        />

        <ol className="steps">
          {supportBlock.steps.map((step) => (
            <li key={step.index} className="step reveal">
              <span className="step__index mono">{step.index}</span>
              <h3 className="step__title">{step.title}</h3>
              <p className="card__text">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Advantages() {
  const ref = useReveal();

  return (
    <section className="section" id="advantages" ref={ref}>
      <div className="shell">
        <SectionHead
          index="06"
          kicker="Преимущества"
          title={'Почему это\nработает вместе'}
          lead="Ценность появляется не в отдельном устройстве, а в том, что оборудование, ПО и сервис собраны в одну систему."
        />

        <ul className="advantages">
          {advantages.map((item, index) => (
            <li key={item.title} className="advantage reveal" style={{ '--reveal-delay': `${index * 60}ms` }}>
              <h3 className="advantage__title">{item.title}</h3>
              <p className="card__text">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
