// features/auth/pendingPersonData.ts
// Временное хранилище персональных данных, введённых на шаге 2 регистрации.
// Они не могут быть отправлены сразу, если аккаунт не активирован (401).
// После активации данные подхватываются и отправляются автоматически.

import type { IPersonRequest } from '@/features/auth/registrationApi';

const KEY = 'elist_pending_person';

export function savePendingPersonData(data: IPersonRequest): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function loadPendingPersonData(): IPersonRequest | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as IPersonRequest) : null;
  } catch {
    return null;
  }
}

export function clearPendingPersonData(): void {
  sessionStorage.removeItem(KEY);
}

export function hasPendingPersonData(): boolean {
  return !!sessionStorage.getItem(KEY);
}
