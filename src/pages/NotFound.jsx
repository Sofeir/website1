import ArrowLink from '../components/ui/ArrowLink.jsx';
import { products } from '../data/products.js';
import '../components/ui/ui.css';

export default function NotFound() {
  return (
    <section className="section" style={{ paddingTop: 'clamp(160px, 24vh, 280px)' }}>
      <div className="shell" style={{ display: 'grid', gap: 28, justifyItems: 'start' }}>
        <p className="kicker">Ошибка 404</p>
        <h1 className="h1">
          Такой страницы нет.
          <br />
          <span className="h-dim">Есть вот это.</span>
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <ArrowLink to="/" variant="solid">
            На главную
          </ArrowLink>
          {products.map((product) => (
            <ArrowLink key={product.id} to={product.route}>
              {product.name}
            </ArrowLink>
          ))}
        </div>
      </div>
    </section>
  );
}
