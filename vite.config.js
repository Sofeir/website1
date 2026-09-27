import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages отдаёт проект по адресу /<репозиторий>/.
  base: '/website1/',
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
