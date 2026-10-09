// Lookup аккаунта по логину или GUID (gift/transfer).

import { apiClient } from '@/shared/api/client';

export interface IAccountLookup {
  id: string;
  login: string;
  avatarId: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** GET /api/accounts/lookup?q= */
export async function lookupAccount(q: string): Promise<IAccountLookup> {
  const r = await apiClient.get<Record<string, unknown>>(
    `/api/accounts/lookup?q=${encodeURIComponent(q.trim())}`,
  );
  const raw = (r.result ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    login: String(raw.login ?? raw.Login ?? ''),
    avatarId: (() => {
      const v = raw.avatarId ?? raw.AvatarId;
      return v == null || v === '' ? null : String(v);
    })(),
    firstName: (() => {
      const v = raw.firstName ?? raw.FirstName;
      return v == null || v === '' ? null : String(v);
    })(),
    lastName: (() => {
      const v = raw.lastName ?? raw.LastName;
      return v == null || v === '' ? null : String(v);
    })(),
  };
}
