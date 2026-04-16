// entities/user/settingsApi.ts

import { apiClient } from '@/shared/api/client';

// ---- Пароль ----

export async function changePassword(payload: {
  oldPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}): Promise<void> {
  await apiClient.post('/api/accounts/changePassword', payload);
}

// ---- Местоположение ----

export async function updateLocation(latitude: number, longitude: number): Promise<void> {
  await apiClient.post('/api/accounts/updateLocation', { latitude, longitude });
}

// ---- Персональные данные ----

export interface IPersonRequest {
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender?: 'Male' | 'Female';
  birthDate?: string;
}

export async function savePersonInfo(payload: IPersonRequest): Promise<void> {
  await apiClient.post('/api/persons/set', payload);
}

export async function getMyPersonInfo(): Promise<IPersonRequest | null> {
  try {
    const r = await apiClient.get<any>('/api/persons/get');
    return r.result ?? null;
  } catch { return null; }
}

// ---- Контакты ----

export interface IContactRequest {
  typeId:                 string;
  value:                  string;
  isAuthorizationContact: boolean;
  show:                   boolean;
}

export async function createContact(payload: IContactRequest): Promise<void> {
  await apiClient.post('/api/contacts/create', payload);
}

export async function updateContact(id: string, payload: IContactRequest): Promise<void> {
  await apiClient.put(`/api/contacts/update/${id}`, payload);
}

export async function getMyContacts(): Promise<any[]> {
  try {
    const r = await apiClient.get<any[]>('/api/contacts/getAccountContacts');
    return r.result ?? [];
  } catch { return []; }
}
