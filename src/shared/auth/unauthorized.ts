// shared/auth/unauthorized.ts

export const PUBLIC_AUTH_ROUTES = ['/login', '/activate', '/register'] as const;

export function isPublicAuthRoute(pathname = window.location.pathname): boolean {
  return PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route));
}

const ACTIVATION_API_MARKERS = ['activation', 'activate'] as const;

/** API активации/авторизации на публичных страницах — без принудительного выхода */
export function isActivationApiPath(path: string): boolean {
  return ACTIVATION_API_MARKERS.some(marker => path.includes(marker));
}

export function isWebSocketUnauthorizedClose(code: number, reason?: string): boolean {
  if (code === 4401 || code === 4001) return true;

  const normalizedReason = (reason ?? '').trim().toLowerCase();
  if (!normalizedReason) return false;

  return (
    normalizedReason.includes('unauthorized')
    || normalizedReason.includes('401')
    || normalizedReason.includes('не авториз')
    || normalizedReason.includes('необходима авторизация')
  );
}

/** WS может прислать JSON с кодом 401 до закрытия соединения */
export function isWebSocketUnauthorizedMessage(data: string): boolean {
  const trimmed = data.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;

  try {
    const json: unknown = JSON.parse(trimmed);
    if (!json || typeof json !== 'object') return false;

    const o = json as Record<string, unknown>;
    const status = o.status ?? o.Status;
    const code = o.code ?? o.Code ?? o.errorCode ?? o.ErrorCode;

    if (status === 401 || code === 401) return true;

    const message = String(o.message ?? o.Message ?? '').toLowerCase();
    return message.includes('unauthorized') || message.includes('не авториз');
  } catch {
    return false;
  }
}
