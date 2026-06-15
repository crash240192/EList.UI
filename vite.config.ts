// vite.config.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/** Обрывы WS/HTTP при навигации и reconnect — не спамим в консоль dev-сервера */
const PROXY_IGNORE_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ERR_STREAM_DESTROYED']);

function isBenignProxyError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === 'string' && PROXY_IGNORE_CODES.has(code);
}

function withQuietProxyErrors(options: ProxyOptions): ProxyOptions {
  return {
    ...options,
    configure: (proxy, opts) => {
      options.configure?.(proxy, opts);

      proxy.on('error', (err: Error, _req: IncomingMessage, res?: ServerResponse | Socket) => {
        if (isBenignProxyError(err)) return;
        if (res && 'writeHead' in res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Proxy error');
        }
        console.error('[vite proxy]', err.message);
      });

      proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
        socket.on('error', (err: Error) => {
          if (isBenignProxyError(err)) return;
          console.error('[vite proxy ws]', err.message);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['html5-qrcode'],
  },
  resolve: {
    alias: {
      // FSD-слои доступны как @/entities/..., @/shared/... и т.д.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Основной API + WebSocket уведомлений (/eList/ws/notifications)
      '/eList': withQuietProxyErrors({
        target: 'http://92.118.113.6:35028',
        changeOrigin: true,
        ws: true,
      }),
      // Файлохранилище
      '/elist/filestorage': withQuietProxyErrors({
        target: 'http://92.118.113.6:35029',
        changeOrigin: true,
      }),
      // Яндекс.Карты — проксируем чтобы не было CORS/401
      '/yandex-maps-api': withQuietProxyErrors({
        target: 'https://api-maps.yandex.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yandex-maps-api/, ''),
        secure: false,
      }),
    },
  },
});
