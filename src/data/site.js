/**
 * Единственное место, где живут контакты, навигация и юридические подписи.
 * Реальных контактов компании в материалах нет — здесь заглушки, помеченные
 * как placeholder, чтобы их нельзя было случайно принять за настоящие.
 */
export const site = {
  name: 'ASOFT',
  legalName: 'ASOFT',
  tagline: 'Автоматизация торговли',
  description:
    'Оборудование, программное обеспечение, внедрение и поддержка в одной системе.',

  contacts: {
    placeholder: true,
    phone: '+7 (000) 000-00-00',
    phoneHref: 'tel:+70000000000',
    email: 'hello@asoft.example',
    emailHref: 'mailto:hello@asoft.example',
    telegram: '@asoft',
    telegramHref: 'https://t.me/asoft',
    address: 'Россия',
    hours: 'Пн–Пт, 9:00–19:00',
  },

  nav: [
    { label: 'Решения', href: '/#solutions' },
    { label: 'Продукты', href: '/#products' },
    { label: 'Услуги', href: '/#services' },
    { label: 'О компании', href: '/#about' },
    { label: 'Поддержка', href: '/#support' },
  ],

  footer: {
    products: [
      { label: 'POS-терминал', href: '/products/pos' },
      { label: 'Касса самообслуживания', href: '/products/self-checkout' },
      { label: 'ПО для POS', href: '/products/pos#software' },
      { label: 'ПО для self-checkout', href: '/products/self-checkout#software' },
    ],
    company: [
      { label: 'О компании', href: '/#about' },
      { label: 'Решения', href: '/#solutions' },
      { label: 'Услуги', href: '/#services' },
      { label: 'Стоимость', href: '/#pricing' },
      { label: 'Вопросы', href: '/#faq' },
    ],
  },
};

/**
 * Ориентировочные суммы для раздела стоимости. Это не прайс-лист:
 * порядок цифр взят по рынку кассового оборудования, итог всегда считается
 * под конкретный проект. Меняется здесь и больше нигде.
 */
export const pricing = {
  disclaimer:
    'Ориентировочные суммы для оценки порядка бюджета. Итоговая стоимость зависит от конфигурации, количества точек и объёма работ.',
  currency: '₽',
  items: [
    {
      id: 'pos-hardware',
      title: 'POS-терминал',
      note: 'Рабочее место кассира',
      from: 74000,
      unit: 'за рабочее место',
    },
    {
      id: 'sco-hardware',
      title: 'Касса самообслуживания',
      note: 'Киоск в сборе',
      from: 390000,
      unit: 'за киоск',
    },
    {
      id: 'pos-software',
      title: 'ПО для POS',
      note: 'Лицензия на рабочее место',
      from: 12000,
      unit: 'за рабочее место',
    },
    {
      id: 'sco-software',
      title: 'ПО для self-checkout',
      note: 'Лицензия на киоск',
      from: 29000,
      unit: 'за киоск',
    },
    {
      id: 'integration',
      title: 'Внедрение и интеграция',
      note: 'Настройка, обмен с учётной системой, обучение',
      from: 18000,
      unit: 'за точку',
    },
    {
      id: 'service',
      title: 'Обслуживание и поддержка',
      note: 'Регламентные работы и обращения',
      from: 4500,
      unit: 'в месяц',
    },
  ],
};

export const formatPrice = (value) => new Intl.NumberFormat('ru-RU').format(value);
