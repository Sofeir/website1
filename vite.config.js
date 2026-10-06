import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages отдаёт проект по адресу /<репозиторий>/, поэтому workflow
  // (.github/workflows/pages.yml) задаёт VITE_BASE=/website1/. Локально и на
  // собственном домене сайт живёт в корне.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5178 },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // three весит заметно больше остального — выносим, чтобы он кешировался отдельно
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/lenis')) return 'motion';
          return undefined;
        },
      },
    },
  },
});
