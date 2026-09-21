/**
 * Заголовок секции в фирменной подаче: индекс, двухтоновый заголовок
 * и сопроводительный текст, прижатый к правому краю на широком экране.
 * Перенос строки в title задаётся символом \n.
 */
export default function SectionHead({ index, kicker, title, lead, id }) {
  const lines = title.split('\n');

  return (
    <header className="section-head" id={id}>
      <div>
        {(index || kicker) && (
          <p className="kicker section-head__meta">
            {index && <span className="section-head__index">{index}</span>}
            {kicker}
          </p>
        )}
        <h2 className="h2">
          {lines.map((line, i) => (
            <span key={line} className={i > 0 ? 'h-dim' : undefined}>
              {line}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </h2>
      </div>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}
