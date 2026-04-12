// entities/user/profileApi.ts
// Получение полного профиля пользователя из трёх эндпоинтов

import { apiClient } from '@/shared/api/client';
import type { Gender } from '@/shared/api/types';

// ---- Типы ----

export interface IAccountData {
  id: string;
  login: string;
}

export interface IContactType {
  id: string;
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
  account: IAccountData;
  contacts: IContactDataItem[];
  person: IPersonInfo | null;
}

// ---- API — текущий пользователь ----

async function fetchMyAccount(): Promise<IAccountData> {
  const data = await apiClient.get<IAccountData>('/api/accounts/getData');
  return data.result;
}

async function fetchMyContacts(): Promise<IContactDataItem[]> {
  const data = await apiClient.get<IContactDataItem[]>('/api/contacts/getAccountContacts');
  return data.result ?? [];
}

async function fetchMyPerson(): Promise<IPersonInfo | null> {
  try {
    // Метод без параметров возвращает персональные данные текущего пользователя
    // Если у пользователя нет PersonInfo — вернёт ошибку, ловим её
    const accountData = await apiClient.get<IAccountData>('/api/accounts/getData');
    const accountId   = accountData.result.id;
    const data = await apiClient.get<IPersonInfo>(`/api/persons/get/${accountId}`);
    return data.result;
  } catch {
    return null;
  }
}

// ---- API — чужой пользователь ----

async function fetchAccountById(accountId: string): Promise<IAccountData> {
  const data = await apiClient.get<IAccountData>(`/api/accounts/getData/${accountId}`);
  return data.result;
}

async function fetchContactsByAccountId(accountId: string): Promise<IContactDataItem[]> {
  const data = await apiClient.get<IContactDataItem[]>(`/api/contacts/getAccountContacts/${accountId}`);
  return data.result ?? [];
}

async function fetchPersonByAccountId(accountId: string): Promise<IPersonInfo | null> {
  try {
    const data = await apiClient.get<IPersonInfo>(`/api/persons/get/${accountId}`);
    return data.result;
  } catch {
    return null;
  }
}

// ---- Публичная функция: загрузить полный профиль ----

/**
 * Загружает аккаунт + контакты + персональные данные одним вызовом.
 * @param accountId — UUID пользователя. Если null/undefined/'me' — загружает текущего.
 */
export async function fetchFullProfile(
  accountId: string | null | undefined
): Promise<IFullProfile> {
  const isMe = !accountId || accountId === 'me';

  const [account, contacts, person] = await Promise.all([
    isMe ? fetchMyAccount()              : fetchAccountById(accountId!),
    isMe ? fetchMyContacts()             : fetchContactsByAccountId(accountId!),
    isMe ? fetchMyPerson()               : fetchPersonByAccountId(accountId!),
  ]);

  return { account, contacts, person };
}
