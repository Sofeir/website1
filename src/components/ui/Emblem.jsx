/**
 * Фирменный знак ASOFT.
 *
 * Отдаётся оригинальным файлом из материалов бренда, без перерисовки и без
 * изменения пропорций. Если понадобится другой размер — меняется только CSS.
 */
export default function Emblem({ className = '', alt = 'ASOFT' }) {
  return <img src="/asoft-emblem.svg" alt={alt} className={`emblem ${className}`.trim()} width="364" height="364" />;
}
