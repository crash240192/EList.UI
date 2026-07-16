// shared/api/client.ts
import {
  handleSessionUnauthorized,
} from '@/shared/auth/sessionUnauthorized';
import {
  isUnauthorizedApiErrorCode,
  shouldForceLogoutForApi,
} from '@/shared/auth/unauthorized';
import { cookies } from '@/shared/lib/cookies';
import type { CommandResult } from './types';
import { isAccessDeniedApiCode } from './errorCodes';

export const COOKIE_CLIENT_HASH = 'elist_client_hash';
export const COOKIE_AUTH_TOKEN  = 'elist_auth_token';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/eList';

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly serverMessage: string | null = null
  ) { super(message); this.name = 'ApiError'; }
}

function generateClientHash(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getOrCreateClientHash(): string {
  let hash = cookies.get(COOKIE_CLIENT_HASH);
  if (!hash) { hash = generateClientHash(); cookies.set(COOKIE_CLIENT_HASH, hash, 3650); }
  return hash;
}

export function getAuthToken(): string | null { return cookies.get(COOKIE_AUTH_TOKEN); }
export function setAuthToken(token: string): void { cookies.set(COOKIE_AUTH_TOKEN, token, 30); }
export function clearAuthToken(): void { cookies.delete(COOKIE_AUTH_TOKEN); }
export function isAuthenticated(): boolean { return !!getAuthToken(); }

/** Сброс сессии и редирект на /login (кроме публичных auth-страниц) */
export function notifyUnauthorized(): void {
  handleSessionUnauthorized();
}

let onApiError: ((message: string) => void) | null = null;
export function setApiErrorHandler(fn: (message: string) => void): void { onApiError = fn; }

const REQUEST_TIMEOUT_MS = 30_000; // 30 секунд

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new ApiError(0, 'Превышено время ожидания ответа сервера')), REQUEST_TIMEOUT_MS)
    ),
  ]);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<CommandResult<T>> {
  const clientHash = getOrCreateClientHash();
  const authToken  = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization-jwt': clientHash,
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = authToken;

  const fetchPromise = fetch(`${BASE_URL}${path}`, { ...options, headers }).then(async response => {
    if (response.status === 401) {
      const hadAuthToken = Boolean(authToken);
      if (shouldForceLogoutForApi(path, hadAuthToken)) notifyUnauthorized();
      throw new ApiError(401, 'Необходима авторизация');
    }
    if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    const data: CommandResult<T> = await response.json();
    if (!data.success) {
      const code = data.errorCode ?? 0;
      const msg = data.message || 'Ошибка API';
      if (shouldForceLogoutForApi(path, Boolean(authToken)) && isUnauthorizedApiErrorCode(code)) {
        notifyUnauthorized();
      }
      // Ошибки доступа показываем в UI блока/страницы, без тоста
      if (data.message && !isAccessDeniedApiCode(code)) onApiError?.(data.message);
      throw new ApiError(code, msg, data.message);
    }
    return data;
  });

  return withTimeout(fetchPromise);
}

/** Запрос только с authorization-jwt клиента (без Authorization) */
async function requestWithClientJwtOnly<T>(
  path: string,
  options: RequestInit = {},
): Promise<CommandResult<T>> {
  const clientHash = getOrCreateClientHash();
  const hadAuthToken = Boolean(getAuthToken());

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization-jwt': clientHash,
    ...(options.headers as Record<string, string>),
  };

  const fetchPromise = fetch(`${BASE_URL}${path}`, { ...options, headers }).then(async response => {
    if (response.status === 401) {
      if (shouldForceLogoutForApi(path, hadAuthToken)) notifyUnauthorized();
      throw new ApiError(401, 'Необходима авторизация');
    }
    if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    const data: CommandResult<T> = await response.json();
    if (!data.success) {
      const code = data.errorCode ?? 0;
      const msg = data.message || 'Ошибка API';
      if (shouldForceLogoutForApi(path, hadAuthToken) && isUnauthorizedApiErrorCode(code)) {
        notifyUnauthorized();
      }
      if (data.message && !isAccessDeniedApiCode(code)) onApiError?.(data.message);
      throw new ApiError(code, msg, data.message);
    }
    return data;
  });

  return withTimeout(fetchPromise);
}

/**
 * GET только с client JWT. Не бросает при success:false и не показывает тост —
 * удобно для статусных проверок (например, согласие 18+).
 */
async function getStatusWithClientJwt(path: string): Promise<boolean> {
  const clientHash = getOrCreateClientHash();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization-jwt': clientHash,
  };

  const fetchPromise = fetch(`${BASE_URL}${path}`, { method: 'GET', headers }).then(async response => {
    if (!response.ok) return false;
    try {
      const data: CommandResult<unknown> = await response.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  });

  return withTimeout(fetchPromise);
}

export const apiClient = {
  get:    <T>(path: string)                 => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
  getWithClientJwt: <T>(path: string) =>
    requestWithClientJwtOnly<T>(path, { method: 'GET' }),
  postWithClientJwt: <T>(path: string, body?: unknown) =>
    requestWithClientJwtOnly<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  /** GET client-JWT: возвращает data.success, без тоста и без throw на success:false */
  getStatusWithClientJwt,
};
