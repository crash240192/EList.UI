// features/auth/passwordResetApi.ts
// Восстановление пароля: код на контакт → проверка → новый пароль + автологин

import { apiClient, setAuthToken } from '@/shared/api/client';
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

/** POST /api/authorization/forgotPassword — тот же authorization-jwt, что и у всей сессии */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<string | null> {
  const data = await apiClient.postWithClientJwt<unknown>('/api/authorization/forgotPassword', {
    login: payload.login.trim(),
  });
  return readResultMessage(data.result, data.message);
}

/** POST /api/authorization/verifyResetCode */
export async function verifyResetCode(payload: VerifyResetCodePayload): Promise<void> {
  await apiClient.postWithClientJwt('/api/authorization/verifyResetCode', {
    login: payload.login.trim(),
    code: payload.code.trim(),
  });
}

/** POST /api/authorization/resetPassword — активный JWT в Authorization, client jwt без изменений */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResult> {
  const data = await apiClient.postWithClientJwt<AuthResponse>('/api/authorization/resetPassword', {
    login: payload.login.trim(),
    code: payload.code.trim(),
    newPassword: payload.newPassword,
    newPasswordConfirmation: payload.newPasswordConfirmation,
  });

  const { token, activationRequired } = data.result;
  setAuthToken(token);
  setActivationRequired(activationRequired);

  return data.result;
}
