import { site } from '../../data/site.js';
import { useReveal } from '../../lib/hooks.js';
import ArrowLink from '../ui/ArrowLink.jsx';

/** Короткая полоса-призыв в середине страницы: два действия, без лишних слов. */
export default function CtaBand() {
  const ref = useReveal();

  return (
    <section className="cta" ref={ref} aria-label="Связаться с ASOFT">
      <div className="shell cta__inner reveal">
        <h2 className="h2 cta__title">
          Посчитаем вашу точку
          <br />
          <span className="h-dim">и покажем, как это работает</span>
        </h2>
        <div className="cta__actions">
          <ArrowLink to="/#contact" variant="solid">
            Оставить заявку
          </ArrowLink>
          <ArrowLink href={site.contacts.phoneHref}>Позвонить</ArrowLink>
        </div>
      </div>
    </section>
  );
}
