// entities/user/profileApi.ts

import { apiClient } from '@/shared/api/client';
import { getStoredAccountId } from '@/entities/user/api';
import type { Gender } from '@/shared/api/types';

export interface IAccountData {
  id: string;
  login: string;
  avatarId?: string | null;
  /** Город по координатам аккаунта (если разрешено locationVisibility) */
  profileCity?: string | null;
}

export interface IContactType {
  id: string;
  name: string;             // основное отображаемое название
  namePath: string;
  localizedName: string | null;
  mask: string | null;
  description: string | null;
  allowNotifications: boolean;
}

export interface IContactDataItem {
  id: string;
  value: string;
  show: boolean;
  isAuthorizationContact: boolean;
  contactType: IContactType | null;
  accountId?: string | null;
  organizationId?: string | null;
}

export interface IPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: Gender | null;
  birthDate: string | null;
  /** Возраст без даты — приходит с бэка по политике приватности */
  ageYears?: number | null;
  /** Акцент «день рождения сегодня» */
  isBirthdayToday?: boolean | null;
}

export interface IFullProfile {
  account:       IAccountData;
  contacts:      IContactDataItem[];
  contactsError: string | null;   // ошибка загрузки контактов (не роняет страницу)
  person:        IPersonInfo | null;
}

// ---- Helpers ----

function normalizeAccount(raw: IAccountData | null | undefined): IAccountData {
  if (!raw || typeof raw !== 'object') {
    return { id: '', login: '' };
  }
  const r = raw as IAccountData & Record<string, unknown>;
  const city = r.profileCity ?? (r as Record<string, unknown>).ProfileCity;
  return {
    id: String(r.id ?? ''),
    login: String(r.login ?? ''),
    avatarId: (r.avatarId ?? null) as string | null,
    profileCity: typeof city === 'string' && city.trim() ? city.trim() : null,
  };
}

async function safeContacts(path: string): Promise<{ data: IContactDataItem[]; error: string | null }> {
  try {
    const res = await apiClient.get<IContactDataItem[]>(path);
    return { data: res.result ?? [], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : 'Ошибка загрузки контактов' };
  }
}

async function safePerson(path: string): Promise<IPersonInfo | null> {
  try {
    const res = await apiClient.get<Record<string, unknown>>(path);
    const raw = res.result;
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, unknown>;
    const ageRaw = p.ageYears ?? p.AgeYears;
    const bdayRaw = p.isBirthdayToday ?? p.IsBirthdayToday;
    return {
      id: String(p.id ?? p.Id ?? ''),
      accountId: String(p.accountId ?? p.AccountId ?? ''),
      firstName: (p.firstName ?? p.FirstName ?? null) as string | null,
      lastName: (p.lastName ?? p.LastName ?? null) as string | null,
      patronymic: (p.patronymic ?? p.Patronymic ?? null) as string | null,
      gender: (p.gender ?? p.Gender ?? null) as IPersonInfo['gender'],
      birthDate: (p.birthDate ?? p.BirthDate ?? null) as string | null,
      ageYears: typeof ageRaw === 'number' ? ageRaw : null,
      isBirthdayToday: typeof bdayRaw === 'boolean' ? bdayRaw : null,
    };
  } catch {
    return null;
  }
}

// ---- Публичная функция ----

export async function fetchFullProfile(
  accountId: string | null | undefined
): Promise<IFullProfile> {
  const isMe = !accountId || accountId === 'me';

  if (isMe) {
    // Для текущего пользователя получаем accountId из cookies если нет в хранилище
    const storedId = getStoredAccountId();

    const [accountRes, contactsRes, person] = await Promise.all([
      apiClient.get<IAccountData>('/api/accounts/getData'),
      safeContacts('/api/contacts/getAccountContacts'),
      // Упрощённый эндпоинт без accountId для текущего пользователя
      safePerson('/api/persons/get'),
    ]);

    return {
      account:       normalizeAccount(accountRes.result),
      contacts:      contactsRes.data,
      contactsError: contactsRes.error,
      person,
    };
  }

  // Для чужого профиля — запросы с accountId
  const [accountRes, contactsRes, person] = await Promise.all([
    apiClient.get<IAccountData>(`/api/accounts/getData/${accountId}`),
    safeContacts(`/api/contacts/getAccountContacts/${accountId}`),
    safePerson(`/api/persons/get/${accountId}`),
  ]);

  return {
    account:       normalizeAccount(accountRes.result),
    contacts:      contactsRes.data,
    contactsError: contactsRes.error,
    person,
  };
}
