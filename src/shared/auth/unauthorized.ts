// shared/auth/unauthorized.ts

import { ApiErrorCode } from '@/shared/api/errorCodes';
import { isPublicAppRoute, isPublicAuthRoute } from './routes';

export { PUBLIC_AUTH_ROUTES, isPublicAuthRoute, isPublicAppRoute } from './routes';

/** API активации и восстановления пароля — без принудительного выхода */
export function isActivationApiPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p.includes('/authorization/activate')
    || p.includes('sendactivationcode')
    || p.includes('forgotpassword')
    || p.includes('verifyresetcode')
    || p.includes('resetpassword')
    || /\/activate(?:\?|$|\/)/.test(p)
    || /\/activation(?:\?|$|\/)/.test(p)
  );
}

/** Нужно ли при 401 / ошибке авторизации сбрасывать сессию */
export function shouldForceLogoutForApi(path: string, hasAuthToken = false): boolean {
  if (isActivationApiPath(path)) return false;
  // Была активная сессия — любая ошибка авторизации завершает её (в т.ч. на гостевых страницах)
  if (hasAuthToken) return true;
  // Гость на публичных страницах — не редиректим
  if (isPublicAppRoute()) return false;
  return true;
}

/** CommandResult.errorCode — истёкший/невалидный токен (HTTP может быть 200) */
export function isUnauthorizedApiErrorCode(code: number): boolean {
  return (
    code === 401
    || code === ApiErrorCode.AuthenticationError
    || code === ApiErrorCode.AuthorizationDataNotFound
    || code === ApiErrorCode.AuthorizationDataInactive
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
