import { ApiError } from './client';
import { isAccessDeniedApiCode, isEventAccessDeniedCode } from './errorCodes';

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getApiErrorCode(err: unknown): number | null {
  return isApiError(err) ? err.code : null;
}

export function isAccessDeniedError(err: unknown): boolean {
  const code = getApiErrorCode(err);
  return code != null && isAccessDeniedApiCode(code);
}

export function isEventAccessDeniedError(err: unknown): boolean {
  const code = getApiErrorCode(err);
  return code != null && isEventAccessDeniedCode(code);
}
