import { Link } from 'react-router-dom';

/** Основная ссылка-действие. Одна форма на весь сайт: контур, стрелка, без заливки. */
export default function ArrowLink({ to, href, children, variant = 'outline', ...rest }) {
  const className = `arrowlink arrowlink--${variant}`;
  const content = (
    <>
      <span>{children}</span>
      <span className="arrowlink__icon" aria-hidden="true">
        ↗
      </span>
    </>
  );

  if (href) {
    return (
      <a className={className} href={href} data-cursor="link" {...rest}>
        {content}
      </a>
    );
  }

  return (
    <Link className={className} to={to} data-cursor="link" {...rest}>
      {content}
    </Link>
  );
}
