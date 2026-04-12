// entities/user/api.ts

import { apiClient } from '@/shared/api/client';
import { cookies } from '@/shared/lib/cookies';

const COOKIE_ACCOUNT_ID = 'elist_account_id';

// ---- Типы ----

interface AccountData {
  id: string;
  login: string;
}

interface AccountDataResult {
  id: string;
  login: string;
  // другие поля аккаунта при необходимости
}

// ---- Cookie helpers ----

export function getStoredAccountId(): string | null {
  return cookies.get(COOKIE_ACCOUNT_ID);
}

function storeAccountId(id: string): void {
  cookies.set(COOKIE_ACCOUNT_ID, id, 30);
}

export function clearAccountId(): void {
  cookies.delete(COOKIE_ACCOUNT_ID);
}

// ---- API ----

/**
 * Получить данные текущего аккаунта.
 * GET /api/accounts/getData
 * Если accountId уже есть в cookies — возвращает его без запроса.
 */
export async function getOrFetchAccountId(): Promise<string> {
  const cached = getStoredAccountId();
  if (cached) return cached;

  const data = await apiClient.get<AccountDataResult>('/api/accounts/getData');
  const id = data.result.id;
  storeAccountId(id);
  return id;
}

/**
 * Получить данные аккаунта по id.
 * GET /api/accounts/getData/{accountId}
 */
export async function fetchAccountById(accountId: string): Promise<AccountData> {
  const data = await apiClient.get<AccountDataResult>(`/api/accounts/getData/${accountId}`);
  return data.result;
}
