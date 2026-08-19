// entities/admin/systemNotificationsApi.ts

import { apiClient } from '@/shared/api/client';

export const SystemNotificationType = {
  AccountCreated: 'AccountCreated',
  PasswordHasBeenChanged: 'PasswordHasBeenChanged',
  Activation: 'Activation',
  ResetPasswordRequest: 'ResetPasswordRequest',
} as const;
export type SystemNotificationTypeValue =
  (typeof SystemNotificationType)[keyof typeof SystemNotificationType];

export const SYSTEM_NOTIFICATION_TYPE_LABELS: Record<SystemNotificationTypeValue, string> = {
  AccountCreated: 'Создание аккаунта',
  PasswordHasBeenChanged: 'Смена пароля',
  Activation: 'Активация',
  ResetPasswordRequest: 'Сброс пароля',
};

export interface ISystemNotification {
  id: string;
  type: SystemNotificationTypeValue;
  header: string;
  message: string;
  shortMessage: string;
}

export interface ISystemNotificationRequest {
  type: SystemNotificationTypeValue;
  header: string;
  message: string;
  shortMessage: string;
}

type Raw = Record<string, unknown>;

function pickStr(r: Raw, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function normalizeType(raw: unknown): SystemNotificationTypeValue {
  const s = String(raw ?? '');
  if ((Object.values(SystemNotificationType) as string[]).includes(s)) {
    return s as SystemNotificationTypeValue;
  }
  return SystemNotificationType.AccountCreated;
}

function normalize(raw: unknown): ISystemNotification {
  const r = (raw ?? {}) as Raw;
  return {
    id: pickStr(r, 'id', 'Id'),
    type: normalizeType(r.type ?? r.Type),
    header: pickStr(r, 'header', 'Header'),
    message: pickStr(r, 'message', 'Message'),
    shortMessage: pickStr(r, 'shortMessage', 'ShortMessage'),
  };
}

export async function fetchAllSystemNotifications(): Promise<ISystemNotification[]> {
  const data = await apiClient.get<unknown[]>('/api/systemNotifications/getAll');
  return (data.result ?? []).map(normalize);
}

export async function fetchSystemNotification(id: string): Promise<ISystemNotification> {
  const data = await apiClient.get<unknown>(`/api/systemNotifications/get/${id}`);
  return normalize(data.result);
}

export async function createSystemNotification(
  payload: ISystemNotificationRequest,
): Promise<string> {
  const data = await apiClient.post<string>('/api/systemNotifications/create', payload);
  return data.result;
}

export async function updateSystemNotification(
  id: string,
  payload: ISystemNotificationRequest,
): Promise<void> {
  await apiClient.put(`/api/systemNotifications/update/${id}`, payload);
}

export async function deleteSystemNotification(id: string): Promise<void> {
  await apiClient.delete(`/api/systemNotifications/delete/${id}`);
}
