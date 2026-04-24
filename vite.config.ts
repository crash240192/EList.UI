// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FSD-слои доступны как @/entities/..., @/shared/... и т.д.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Основной API
      '/eList': {
        target: 'http://92.118.113.6:35028',
        changeOrigin: true,
      },
      // Файлохранилище
      '/elist/filestorage': {
        target: 'http://92.118.113.6:35029',
        changeOrigin: true,
      },
      // Яндекс.Карты — проксируем чтобы не было CORS/401
      '/yandex-maps-api': {
        target: 'https://api-maps.yandex.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yandex-maps-api/, ''),
        secure: false,
      },
    },
  },
});
