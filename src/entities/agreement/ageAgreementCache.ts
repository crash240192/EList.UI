// TTL анонимного подтверждения 18+ совпадает с бэкендом (сутки).
// In-memory кеш не должен переживать TTL — иначе фильтры 18+ останутся без повторной проверки.

import { agreeAnonymousAge, getAnonymousAgeAgreement } from './api';

/** Срок жизни подтверждения на бэкенде */
export const ANONYMOUS_AGE_AGREEMENT_TTL_MS = 24 * 60 * 60 * 1000;

let cachedOk: boolean | null = null;
let cachedAt = 0;

function isFreshPositive(): boolean {
  return (
    cachedOk === true
    && Date.now() - cachedAt < ANONYMOUS_AGE_AGREEMENT_TTL_MS
  );
}

/** Проверить согласие 18+ с учётом TTL (сутки на бэкенде). */
export async function checkAnonymousAgeAgreement(force = false): Promise<boolean> {
  if (!force && isFreshPositive()) return true;
  try {
    const ok = await getAnonymousAgeAgreement();
    if (ok) {
      cachedOk = true;
      cachedAt = Date.now();
      return true;
    }
    cachedOk = null;
    cachedAt = 0;
    return false;
  } catch {
    cachedOk = null;
    cachedAt = 0;
    return false;
  }
}

/** Подтвердить возраст и запомнить локально до истечения TTL. */
export async function confirmAnonymousAgeAgreement(): Promise<void> {
  await agreeAnonymousAge();
  cachedOk = true;
  cachedAt = Date.now();
}

export function clearAnonymousAgeAgreementCache(): void {
  cachedOk = null;
  cachedAt = 0;
}
