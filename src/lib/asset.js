/**
 * Путь к файлу из `public/` с учётом base.
 *
 * Сайт живёт не только в корне домена: на GitHub Pages он открывается по
 * `/website1/`, и абсолютный `/products/pos.webp` уводил бы мимо файла.
 * `BASE_URL` задаёт vite.config.js и всегда заканчивается на `/`.
 */
export const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
