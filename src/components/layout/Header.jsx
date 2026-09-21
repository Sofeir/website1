import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { site } from '../../data/site.js';
import Emblem from '../ui/Emblem.jsx';
import './header.css';

/**
 * Шапка. На первом экране почти невидима, при прокрутке собирается
 * в компактную панель. Состояние переключается классом из rAF-подписки —
 * прокрутка не должна перерисовывать React-дерево.
 */
export default function Header() {
  const ref = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let condensed = false;
    let frame = 0;

    const check = () => {
      frame = requestAnimationFrame(check);
      const next = window.scrollY > window.innerHeight * 0.35;
      if (next === condensed) return;
      condensed = next;
      node.classList.toggle('is-condensed', next);
    };

    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header ref={ref} className="header" data-open={menuOpen || undefined}>
      <div className="header__inner">
        <Link to="/" className="header__brand" aria-label="ASOFT — на главную" data-cursor="link">
          <Emblem className="header__emblem" />
          <span className="header__brandmeta">
            <span className="mono">{site.tagline}</span>
          </span>
        </Link>

        <nav className="header__nav" aria-label="Основная навигация">
          {site.nav.map((item) => (
            <Link key={item.href} to={item.href} className="header__link" data-cursor="link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <Link to="/#contact" className="header__cta" data-cursor="link">
            Связаться
          </Link>
          <button
            type="button"
            className="header__burger"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="visually-hidden">{menuOpen ? 'Закрыть меню' : 'Открыть меню'}</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <div id="mobile-nav" className="header__mobile" hidden={!menuOpen}>
        <nav aria-label="Мобильная навигация">
          {site.nav.map((item) => (
            <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link to="/#contact" className="header__mobilecta" onClick={() => setMenuOpen(false)}>
            Связаться
          </Link>
        </nav>
      </div>
    </header>
  );
}
