// features/auth/registrationApi.ts

import { apiClient } from '@/shared/api/client';
import type { Gender } from '@/shared/api/types';

// ---- Типы ----

export interface IContactType {
  id: string;
  namePath: string;
  localizedName: string | null;
  description: string | null;
  mask: string | null;           // маска для поля ввода (напр. "+7(###)###-##-##")
  allowNotifications: boolean;
}

export interface ICreateAccountRequest {
  login: string;
  password: string;
  passwordConfirmation: string;
  authorizationContactValue: string;
  authorizationContactType: string;
  showContact: boolean;
  latitude?: number;
  longitude?: number;
}

export interface IPersonRequest {
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender?: Gender;
  birthDate?: string;  // ISO 8601
}

// ---- API ----

/**
 * Получить список типов контактов.
 * GET /api/contacts/contactTypes/getAll
 */
export async function fetchContactTypes(): Promise<IContactType[]> {
  const data = await apiClient.get<IContactType[]>('/api/contacts/contactTypes/getAll');
  return data.result ?? [];
}

/**
 * Создать аккаунт.
 * POST /api/accounts/create
 * Не требует авторизации (authorization-jwt клиентского хеша достаточно).
 */
export async function createAccount(payload: ICreateAccountRequest): Promise<void> {
  await apiClient.post('/api/accounts/create', payload);
}

/**
 * Сохранить личную информацию пользователя.
 * POST /api/persons/set
 * Требует авторизации (вызывать после логина).
 */
export async function setPersonInfo(payload: IPersonRequest): Promise<void> {
  await apiClient.post('/api/persons/set', payload);
}
