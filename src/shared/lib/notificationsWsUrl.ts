// shared/lib/notificationsWsUrl.ts

import { getAuthToken, getOrCreateClientHash } from '@/shared/api/client';

/**
 * URL WebSocket: ws(s)://host/eList/ws/notifications?authorization=…&authorization-jwt=…
 */
export function buildNotificationsWebSocketUrl(): string | null {
  const clientHash = getOrCreateClientHash();
  const authToken = getAuthToken();
  if (!authToken) return null;

  const params = new URLSearchParams();
  params.set('authorization', authToken);
  params.set('authorization-jwt', clientHash);

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/eList';
  const query = params.toString();

  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const url = new URL(apiBase);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const basePath = url.pathname.replace(/\/$/, '') || '/eList';
    return `${wsProto}//${url.host}${basePath}/ws/notifications?${query}`;
  }

  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = apiBase.startsWith('/') ? apiBase : `/${apiBase}`;
  const basePath = path.replace(/\/$/, '') || '/eList';
  return `${wsProto}//${window.location.host}${basePath}/ws/notifications?${query}`;
}
