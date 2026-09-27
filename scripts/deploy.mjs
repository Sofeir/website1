/**
 * Публикация на GitHub Pages.
 *
 * 1. `npm run build` — base '/website1/' задан в vite.config.js: Pages отдаёт
 *    проект по адресу `/<репозиторий>/`, без него пути к файлам уходят мимо.
 * 2. dist/404.html = копия index.html. Pages не умеет SPA-маршруты: на
 *    /website1/products/pos он отдаёт 404.html, и роутер поднимает нужную страницу.
 * 3. dist/.nojekyll — чтобы Pages не обрабатывал файлы Jekyll'ом.
 * 4. gh-pages пушит dist в ветку gh-pages.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ghpages from 'gh-pages';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = '/website1/';

const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

copyFileSync(join(root, 'dist', 'index.html'), join(root, 'dist', '404.html'));
writeFileSync(join(root, 'dist', '.nojekyll'), '');

ghpages.publish(
  join(root, 'dist'),
  {
    branch: 'gh-pages',
    dotfiles: true,
    message: 'Деплой на GitHub Pages',
    user: { name: 'Sofeir', email: 'sofei345@gmail.com' },
  },
  (error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    console.log(`Опубликовано. Адрес: https://sofeir.github.io${base}`);
  }
);
