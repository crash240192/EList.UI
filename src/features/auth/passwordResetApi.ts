// features/auth/passwordResetApi.ts
// Восстановление пароля: код на контакт → проверка → новый пароль + автологин

import {
  apiClient,
  clearPasswordResetClientJwt,
  getOrCreatePasswordResetClientJwt,
  setAuthToken,
  setPasswordResetClientJwt,
} from '@/shared/api/client';
import type { AuthResponse } from './api';
import { setActivationRequired } from './api';

export interface ForgotPasswordPayload {
  login: string;
}

export interface VerifyResetCodePayload {
  login: string;
  code: string;
}

export interface ResetPasswordPayload {
  login: string;
  code: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export interface ResetPasswordResult extends AuthResponse {}

function readResultMessage(result: unknown, fallbackMessage?: string | null): string | null {
  if (typeof result === 'string') {
    const text = result.trim();
    if (text) return text;
  }
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    const nested = r.message ?? r.Message;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return fallbackMessage?.trim() || null;
}

function readResetClientJwt(result: unknown): string | null {
  if (typeof result === 'string') {
    const text = result.trim();
    return text || null;
  }
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    const token = r.token ?? r.Token ?? r.jwt ?? r.Jwt;
    if (typeof token === 'string' && token.trim()) return token.trim();
  }
  return null;
}

function postWithResetClientJwt<T>(path: string, body: unknown) {
  const resetJwt = getOrCreatePasswordResetClientJwt();
  return apiClient.postWithAuthorizationJwt<T>(path, resetJwt, body);
}

/** POST /api/authorization/forgotPassword — регистрирует неактивный клиентский JWT */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<string | null> {
  const resetJwt = getOrCreatePasswordResetClientJwt();
  const data = await apiClient.postWithAuthorizationJwt<unknown>(
    '/api/authorization/forgotPassword',
    resetJwt,
    { login: payload.login.trim() },
  );

  const jwtFromResult = readResetClientJwt(data.result);
  if (jwtFromResult) setPasswordResetClientJwt(jwtFromResult);

  return readResultMessage(data.result, data.message);
}

/** POST /api/authorization/verifyResetCode */
export async function verifyResetCode(payload: VerifyResetCodePayload): Promise<void> {
  await postWithResetClientJwt('/api/authorization/verifyResetCode', {
    login: payload.login.trim(),
    code: payload.code.trim(),
  });
}

/** POST /api/authorization/resetPassword — активный JWT, старые сессии инвалидируются на бэкенде */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResult> {
  const data = await postWithResetClientJwt<AuthResponse>('/api/authorization/resetPassword', {
    login: payload.login.trim(),
    code: payload.code.trim(),
    newPassword: payload.newPassword,
    newPasswordConfirmation: payload.newPasswordConfirmation,
  });

  const { token, activationRequired } = data.result;
  clearPasswordResetClientJwt();
  setAuthToken(token);
  setActivationRequired(activationRequired);

  return data.result;
}

export { clearPasswordResetClientJwt } from '@/shared/api/client';
