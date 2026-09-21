/**
 * Макеты интерфейсов ПО.
 *
 * Реальных снимков экрана в материалах пока нет. Пока их нет, раздел показывает
 * макет: он собран из тех же сущностей, что и настоящее приложение (категории,
 * позиции чека, итог, оплата). Как только появятся снимки, достаточно указать
 * `screenshot` у приложения в data/content.js — SoftwareShowcase покажет
 * изображение вместо макета, разметку менять не нужно.
 */

const posCategories = ['Горячее', 'Салаты', 'Выпечка', 'Напитки', 'Десерты'];

const posItems = [
  { name: 'Борщ', price: '180', unit: 'порция' },
  { name: 'Плов', price: '240', unit: 'порция' },
  { name: 'Салат овощной', price: '120', unit: 'порция' },
  { name: 'Котлета куриная', price: '160', unit: 'шт' },
  { name: 'Компот', price: '60', unit: '0,3 л' },
  { name: 'Хлеб', price: '15', unit: 'шт' },
  { name: 'Сырники', price: '190', unit: 'порция' },
  { name: 'Чай', price: '45', unit: '0,2 л' },
];

const posReceipt = [
  { name: 'Борщ', qty: '1', sum: '180,00' },
  { name: 'Плов', qty: '2', sum: '480,00' },
  { name: 'Компот', qty: '1', sum: '60,00' },
];

export function PosMock() {
  return (
    <div className="mock mock--pos" role="img" aria-label="Макет интерфейса кассового приложения ASOFT POS">
      <div className="mock__bar">
        <span className="mock__dot" />
        <span className="mock__barlabel">ASOFT POS — Смена 42 · Касса 13</span>
        <span className="mock__barmeta">Кассир · PIN 1234</span>
      </div>

      <div className="mock__body">
        <aside className="mock__side">
          {posCategories.map((category, index) => (
            <span key={category} className="mock__cat" data-active={index === 0 || undefined}>
              {category}
            </span>
          ))}
        </aside>

        <div className="mock__grid">
          {posItems.map((item) => (
            <span key={item.name} className="mock__item">
              <span className="mock__itemname">{item.name}</span>
              <span className="mock__itemmeta">
                {item.price} ₽ · {item.unit}
              </span>
            </span>
          ))}
        </div>

        <aside className="mock__receipt">
          <span className="mock__receipthead">Чек № 118</span>
          <ul>
            {posReceipt.map((line) => (
              <li key={line.name}>
                <span>{line.name}</span>
                <span className="mock__qty">×{line.qty}</span>
                <span>{line.sum}</span>
              </li>
            ))}
          </ul>
          <div className="mock__total">
            <span>Итого</span>
            <span className="mock__sum">720,00 ₽</span>
          </div>
          <span className="mock__pay">Оплата</span>
        </aside>
      </div>
    </div>
  );
}

export function ScoMock() {
  return (
    <div
      className="mock mock--sco"
      role="img"
      aria-label="Макет интерфейса кассы самообслуживания ASOFT Self-Checkout"
    >
      <div className="mock__scohead">
        <span className="mock__dot" />
        Отсканируйте товар
      </div>

      <ul className="mock__scolist">
        <li>
          <span>Хлеб бездрожжевой</span>
          <span>62,00</span>
        </li>
        <li>
          <span>Молоко 3,2% 1 л</span>
          <span>94,00</span>
        </li>
        <li>
          <span>Яблоки, 0,74 кг</span>
          <span>133,20</span>
        </li>
      </ul>

      <div className="mock__scototal">
        <span>К оплате</span>
        <span className="mock__sum">289,20 ₽</span>
      </div>

      <div className="mock__scoactions">
        <span className="mock__scobtn mock__scobtn--primary">Оплатить</span>
        <span className="mock__scobtn">Позвать сотрудника</span>
      </div>
    </div>
  );
}

export default function SoftwareMock({ kind }) {
  return kind === 'sco' ? <ScoMock /> : <PosMock />;
}
