import { about } from '../../data/content.js';
import { useReveal } from '../../lib/hooks.js';
import SectionHead from '../ui/SectionHead.jsx';

export default function About() {
  const ref = useReveal();

  return (
    <section className="section" id="about" ref={ref}>
      <div className="shell">
        <SectionHead index="01" kicker={about.kicker} title={about.title} lead={about.lead} />

        <div className="pillars">
          {about.pillars.map((pillar, index) => (
            <article
              key={pillar.index}
              className="pillar reveal"
              style={{ '--reveal-delay': `${index * 80}ms` }}
            >
              <p className="pillar__index mono">{pillar.index}</p>
              <h3 className="pillar__title">{pillar.title}</h3>
              <p className="pillar__text">{pillar.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
