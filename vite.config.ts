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
      // Проксируем API-запросы чтобы избежать CORS в dev
      '/eList': {
        target: 'http://92.118.113.6:35028',
        changeOrigin: true,
      },
    },
  },
});
