// entities/user/privacyApi.ts — настройки приватности профиля

import { apiClient } from '@/shared/api/client';

/** Совпадает с EList.Models.Enums.PrivacyAudience */
export type PrivacyAudience =
  | 'Everyone'
  | 'Subscriptions'
  | 'Subscribers'
  | 'Mutual'
  | 'Nobody';

export const PRIVACY_AUDIENCE_OPTIONS: { value: PrivacyAudience; label: string }[] = [
  { value: 'Everyone', label: 'Все' },
  { value: 'Subscriptions', label: 'Только те, на кого я подписан' },
  { value: 'Subscribers', label: 'Только мои подписчики' },
  { value: 'Mutual', label: 'Только взаимные подписки' },
  { value: 'Nobody', label: 'Никто' },
];

/** Короткая подсказка под селектом аудитории (видимость данных). */
export const PRIVACY_AUDIENCE_HINTS: Record<PrivacyAudience, string> = {
  Everyone: 'Видно всем авторизованным пользователям',
  Subscriptions: 'Видно только тем, на кого вы подписаны',
  Subscribers: 'Видно только вашим подписчикам',
  Mutual: 'Видно только при взаимной подписке',
  Nobody: 'Скрыто от всех',
};

export const WHO_CAN_INVITE_OPTIONS: { value: PrivacyAudience; label: string }[] = [
  { value: 'Everyone', label: 'Все' },
  { value: 'Subscriptions', label: 'Только те, на кого я подписан' },
  { value: 'Subscribers', label: 'Только мои подписчики' },
  { value: 'Mutual', label: 'Только взаимные подписки' },
  { value: 'Nobody', label: 'Никто' },
];

/** Подсказка под «Кто может приглашать». */
export const WHO_CAN_INVITE_HINTS: Record<PrivacyAudience, string> = {
  Everyone: 'Пригласить вас сможет любой пользователь',
  Subscriptions: 'Приглашать могут только те, на кого вы подписаны',
  Subscribers: 'Приглашать могут только ваши подписчики',
  Mutual: 'Приглашать можно только при взаимной подписке',
  Nobody: 'Вас никто не сможет пригласить',
};

export interface IAccountPrivacySettings {
  accountId: string;
  whoCanInviteMe: PrivacyAudience;
  ageVisibility: PrivacyAudience;
  genderVisibility: PrivacyAudience;
  showBirthdayToday: boolean;
  locationVisibility: PrivacyAudience;
  profilePhotosVisibility: PrivacyAudience;
  updatedAt?: string | null;
}

export interface IUpdatePrivacySettingsRequest {
  whoCanInviteMe?: PrivacyAudience;
  ageVisibility?: PrivacyAudience;
  genderVisibility?: PrivacyAudience;
  showBirthdayToday?: boolean;
  locationVisibility?: PrivacyAudience;
  profilePhotosVisibility?: PrivacyAudience;
}

export interface ICanInviteResult {
  allowed: boolean;
  reason: string | null;
}

function normalizeAudience(raw: unknown, fallback: PrivacyAudience): PrivacyAudience {
  if (typeof raw === 'string' && PRIVACY_AUDIENCE_OPTIONS.some(o => o.value === raw)) {
    return raw as PrivacyAudience;
  }
  if (typeof raw === 'number') {
    const map: PrivacyAudience[] = ['Everyone', 'Subscriptions', 'Subscribers', 'Mutual', 'Nobody'];
    return map[raw] ?? fallback;
  }
  return fallback;
}

function normalizeSettings(raw: unknown): IAccountPrivacySettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    accountId: String(r.accountId ?? r.AccountId ?? ''),
    whoCanInviteMe: normalizeAudience(r.whoCanInviteMe ?? r.WhoCanInviteMe, 'Everyone'),
    ageVisibility: normalizeAudience(r.ageVisibility ?? r.AgeVisibility, 'Nobody'),
    genderVisibility: normalizeAudience(r.genderVisibility ?? r.GenderVisibility, 'Nobody'),
    showBirthdayToday: Boolean(r.showBirthdayToday ?? r.ShowBirthdayToday ?? false),
    locationVisibility: normalizeAudience(r.locationVisibility ?? r.LocationVisibility, 'Nobody'),
    profilePhotosVisibility: normalizeAudience(
      r.profilePhotosVisibility ?? r.ProfilePhotosVisibility,
      'Everyone',
    ),
    updatedAt: (r.updatedAt ?? r.UpdatedAt ?? null) as string | null,
  };
}

/** GET /api/accounts/privacy */
export async function fetchMyPrivacySettings(): Promise<IAccountPrivacySettings> {
  const r = await apiClient.get<unknown>('/api/accounts/privacy');
  return normalizeSettings(r.result);
}

/** PUT /api/accounts/privacy */
export async function updateMyPrivacySettings(
  payload: IUpdatePrivacySettingsRequest,
): Promise<IAccountPrivacySettings> {
  const r = await apiClient.put<unknown>('/api/accounts/privacy', payload);
  return normalizeSettings(r.result);
}

/** GET /api/accounts/canInvite/{accountId} */
export async function fetchCanInvite(accountId: string): Promise<ICanInviteResult> {
  const r = await apiClient.get<{ allowed?: boolean; Allowed?: boolean; reason?: string | null; Reason?: string | null }>(
    `/api/accounts/canInvite/${accountId}`,
  );
  const res = r.result ?? {};
  return {
    allowed: Boolean(res.allowed ?? res.Allowed),
    reason: (res.reason ?? res.Reason ?? null) as string | null,
  };
}

/** POST /api/accounts/canInvite/batch — до 100 id */
export async function fetchCanInviteBatch(
  accountIds: string[],
): Promise<Map<string, ICanInviteResult>> {
  const unique = [...new Set(accountIds.filter(Boolean))];
  const map = new Map<string, ICanInviteResult>();
  if (unique.length === 0) return map;

  const r = await apiClient.post<Array<{
    accountId?: string;
    AccountId?: string;
    allowed?: boolean;
    Allowed?: boolean;
    reason?: string | null;
    Reason?: string | null;
  }>>('/api/accounts/canInvite/batch', { accountIds: unique });

  for (const item of r.result ?? []) {
    const id = String(item.accountId ?? item.AccountId ?? '');
    if (!id) continue;
    map.set(id, {
      allowed: Boolean(item.allowed ?? item.Allowed),
      reason: (item.reason ?? item.Reason ?? null) as string | null,
    });
  }
  return map;
}
