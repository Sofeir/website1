import { Link } from 'react-router-dom';
import { site } from '../../data/site.js';
import { prefersReducedMotion, setMotionPreference } from '../../lib/scroll.js';
import Emblem from '../ui/Emblem.jsx';
import './footer.css';

export default function Footer() {
  // Режим движения переключается вручную: системная настройка приходит и от
  // энергосбережения браузера, а не только от человека.
  const reduced = prefersReducedMotion();

  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__brand">
          <Emblem className="footer__emblem" alt="ASOFT" />
          <p className="footer__claim">
            Оборудование, программное обеспечение,
            <br />
            внедрение и поддержка в одной системе.
          </p>
        </div>

        <nav className="footer__cols" aria-label="Навигация в подвале">
          <div>
            <p className="kicker">Продукты</p>
            <ul>
              {site.footer.products.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} data-cursor="link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="kicker">Компания</p>
            <ul>
              {site.footer.company.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} data-cursor="link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="kicker">Контакты</p>
            <ul>
              <li>
                <a href={site.contacts.phoneHref} data-cursor="link">
                  {site.contacts.phone}
                </a>
              </li>
              <li>
                <a href={site.contacts.emailHref} data-cursor="link">
                  {site.contacts.email}
                </a>
              </li>
              <li>
                <a
                  href={site.contacts.telegramHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-cursor="link"
                >
                  Telegram {site.contacts.telegram}
                </a>
              </li>
              <li className="footer__hours">{site.contacts.hours}</li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="shell footer__bottom">
        <p className="mono">© {new Date().getFullYear()} {site.name}</p>
        <button
          type="button"
          className="mono footer__motion"
          data-cursor="link"
          onClick={() => setMotionPreference(reduced ? 'full' : 'reduced')}
        >
          {reduced ? 'Включить анимацию' : 'Отключить анимацию'}
        </button>
        {site.contacts.placeholder && (
          <p className="mono footer__placeholder">
            Контакты указаны как примерные и заменяются в src/data/site.js
          </p>
        )}
      </div>

      <div className="footer__watermark" aria-hidden="true">
        <Emblem alt="" />
      </div>
    </footer>
  );
}
