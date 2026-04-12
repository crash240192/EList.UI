// features/auth/api.ts
// Методы авторизации и активации аккаунта

import { apiClient, setAuthToken, clearAuthToken } from '@/shared/api/client';
import { cookies } from '@/shared/lib/cookies';
import { clearAccountId } from '@/entities/user/api';

// ---- Типы ----

export interface AuthResponse {
  token: string;           // GUID — основной auth-токен
  activationRequired: boolean;
}

export interface LoginPayload {
  login: string;
  password: string;
}

// ---- Cookie для activationRequired ----

const COOKIE_ACTIVATION = 'elist_activation_required';

export function getActivationRequired(): boolean {
  return cookies.get(COOKIE_ACTIVATION) === 'true';
}

export function setActivationRequired(value: boolean): void {
  if (value) cookies.set(COOKIE_ACTIVATION, 'true', 1);
  else cookies.delete(COOKIE_ACTIVATION);
}

// ---- Логин ----
// POST /api/authorization
// Заголовок authorization-jwt уже добавляет apiClient автоматически

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>('/api/authorization', payload);
  const { token, activationRequired } = data.result;

  setAuthToken(token);
  setActivationRequired(activationRequired);

  return data.result;
}

// ---- Активация аккаунта ----
// GET /api/authorization/activate?activationKey={key}

export async function activateAccount(activationKey: string): Promise<void> {
  await apiClient.get(`/api/authorization/activate?activationKey=${encodeURIComponent(activationKey)}`);
  setActivationRequired(false);
}

// ---- Проверка текущего токена ----
// GET /api/authorization/check

export async function checkAuth(): Promise<boolean> {
  try {
    await apiClient.get('/api/authorization/check');
    return true;
  } catch {
    return false;
  }
}

// ---- Выход ----

export function logout(): void {
  clearAuthToken();
  clearAccountId();
  setActivationRequired(false);
}
