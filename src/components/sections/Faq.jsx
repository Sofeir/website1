import { useState } from 'react';
import { faq } from '../../data/content.js';
import { useReveal } from '../../lib/hooks.js';
import SectionHead from '../ui/SectionHead.jsx';

/**
 * Вопросы и ответы.
 *
 * Раскрытие сделано на grid-template-rows: 0fr → 1fr: высота анимируется
 * средствами CSS, без измерений в JS и без скачков при первом рендере.
 * Одновременно открыт один вопрос — так список остаётся читаемым.
 */
export default function Faq() {
  const ref = useReveal();
  const [open, setOpen] = useState(0);

  return (
    <section className="section" id="faq" ref={ref}>
      <div className="shell">
        <SectionHead
          index="08"
          kicker="Вопросы"
          title={'Что обычно\nспрашивают'}
          lead="Короткие ответы на вопросы, которые возникают до начала проекта."
        />

        <div className="faq">
          {faq.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.q} className="faq__item reveal" data-open={isOpen || undefined}>
                <h3 className="faq__heading">
                  <button
                    type="button"
                    className="faq__trigger"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    id={`faq-trigger-${index}`}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    data-cursor="link"
                  >
                    <span className="faq__index mono">{String(index + 1).padStart(2, '0')}</span>
                    <span className="faq__question">{item.q}</span>
                    <span className="faq__sign" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  className="faq__panel"
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                >
                  <div className="faq__panelinner">
                    <p className="faq__answer">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
