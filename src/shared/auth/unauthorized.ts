// shared/auth/unauthorized.ts

import { ApiErrorCode } from '@/shared/api/errorCodes';

export const PUBLIC_AUTH_ROUTES = ['/login', '/activate', '/register'] as const;

export function isPublicAuthRoute(pathname = window.location.pathname): boolean {
  return PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route));
}

/** API активации — без принудительного выхода (страницы /login, /activate, /register) */
export function isActivationApiPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p.includes('/authorization/activate')
    || p.includes('sendactivationcode')
    || /\/activate(?:\?|$|\/)/.test(p)
    || /\/activation(?:\?|$|\/)/.test(p)
  );
}

/** Нужно ли при 401 сбрасывать сессию для этого запроса */
export function shouldForceLogoutForApi(path: string): boolean {
  if (isPublicAuthRoute()) return false;
  if (isActivationApiPath(path)) return false;
  return true;
}

/** CommandResult.errorCode — истёкший/невалидный токен (HTTP может быть 200) */
export function isUnauthorizedApiErrorCode(code: number): boolean {
  return (
    code === 401
    || code === ApiErrorCode.AuthenticationError
    || code === ApiErrorCode.AuthorizationDataNotFound
  );
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
