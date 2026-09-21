import { useState } from 'react';
import { site } from '../../data/site.js';
import { sendLead } from '../../lib/api.js';
import { useReveal } from '../../lib/hooks.js';

const EMPTY = { name: '', phone: '', comment: '' };

/**
 * Заявка. Четыре состояния: idle → loading → success | error,
 * с возможностью повторить отправку. Валидация минимальная и говорящая:
 * форма не должна отказывать без объяснения.
 */
export default function Contact() {
  const ref = useReveal();
  const [values, setValues] = useState(EMPTY);
  const [status, setStatus] = useState('idle');
  const [errors, setErrors] = useState({});

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (values.name.trim().length < 2) next.name = 'Укажите, как к вам обращаться';
    const digits = values.phone.replace(/\D/g, '');
    if (digits.length < 10) next.phone = 'Телефон из 10–11 цифр';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (status === 'loading') return;
    if (!validate()) return;

    setStatus('loading');
    try {
      await sendLead({ ...values, page: window.location.pathname });
      setStatus('success');
      setValues(EMPTY);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <section className="section section--raise" id="contact" ref={ref}>
      <div className="shell contact">
        <div className="contact__intro reveal">
          <p className="kicker">
            <span className="section-head__index">09</span> Обсудить проект
          </p>
          <h2 className="h2">
            Расскажите о точке —
            <br />
            <span className="h-dim">предложим конфигурацию</span>
          </h2>
          <p className="lead">
            Формат бизнеса, количество касс и учётная система — этого достаточно, чтобы собрать
            первое предложение.
          </p>

          <ul className="contact__list">
            <li>
              <span className="mono">Телефон</span>
              <a href={site.contacts.phoneHref} data-cursor="link">
                {site.contacts.phone}
              </a>
            </li>
            <li>
              <span className="mono">Почта</span>
              <a href={site.contacts.emailHref} data-cursor="link">
                {site.contacts.email}
              </a>
            </li>
            <li>
              <span className="mono">Telegram</span>
              <a href={site.contacts.telegramHref} data-cursor="link" rel="noreferrer noopener" target="_blank">
                {site.contacts.telegram}
              </a>
            </li>
            <li>
              <span className="mono">Время работы</span>
              <span>{site.contacts.hours}</span>
            </li>
          </ul>
        </div>

        <form className="form reveal" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="lead-name">Имя</label>
            <input
              id="lead-name"
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={update('name')}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'lead-name-error' : undefined}
              placeholder="Как к вам обращаться"
            />
            {errors.name && (
              <p className="field__error" id="lead-name-error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="lead-phone">Телефон</label>
            <input
              id="lead-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={update('phone')}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
              placeholder="+7 ___ ___-__-__"
            />
            {errors.phone && (
              <p className="field__error" id="lead-phone-error">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="lead-comment">Комментарий</label>
            <textarea
              id="lead-comment"
              name="comment"
              rows={4}
              value={values.comment}
              onChange={update('comment')}
              placeholder="Формат точки, количество касс, учётная система"
            />
          </div>

          <div className="form__foot">
            <button type="submit" className="form__submit" data-cursor="link" disabled={status === 'loading'}>
              <span>{status === 'loading' ? 'Отправляем' : 'Обсудить проект'}</span>
              <span className="form__icon" aria-hidden="true">
                {status === 'loading' ? '·' : '↗'}
              </span>
            </button>
            <p className="form__note">
              Нажимая кнопку, вы соглашаетесь на обработку указанных контактных данных.
            </p>
          </div>

          <p className="form__status" role="status" aria-live="polite" data-state={status}>
            {status === 'success' && 'Заявка принята. Мы свяжемся с вами в рабочее время.'}
            {status === 'error' && 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.'}
          </p>
        </form>
      </div>
    </section>
  );
}
