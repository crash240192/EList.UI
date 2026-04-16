// entities/user/profileApi.ts

import { apiClient } from '@/shared/api/client';
import { getStoredAccountId } from '@/entities/user/api';
import type { Gender } from '@/shared/api/types';

export interface IAccountData {
  id: string;
  login: string;
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
  accountId: string;
}

export interface IPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: Gender | null;
  birthDate: string | null;
}

export interface IFullProfile {
  account:       IAccountData;
  contacts:      IContactDataItem[];
  contactsError: string | null;   // ошибка загрузки контактов (не роняет страницу)
  person:        IPersonInfo | null;
}

// ---- Helpers ----

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
    const res = await apiClient.get<IPersonInfo>(path);
    return res.result ?? null;
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
      account:       accountRes.result,
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
    account:       accountRes.result,
    contacts:      contactsRes.data,
    contactsError: contactsRes.error,
    person,
  };
}
