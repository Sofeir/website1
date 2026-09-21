/**
 * Отправка заявки.
 *
 * Бэкенда у сайта пока нет. Адрес приёма задаётся переменной окружения
 * VITE_LEAD_ENDPOINT (см. .env.example): как только он появится, форма начнёт
 * отправлять туда JSON без изменений в компонентах. Без переменной работает
 * демонстрационный режим — заявка никуда не уходит, о чём предупреждаем в консоли.
 */
export async function sendLead(payload) {
  const endpoint = import.meta.env.VITE_LEAD_ENDPOINT;

  if (!endpoint) {
    console.warn('[asoft] VITE_LEAD_ENDPOINT не задан — заявка не отправлена:', payload);
    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });
    return { ok: true, demo: true };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Сервер ответил ${response.status}`);
  return { ok: true };
}
