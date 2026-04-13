// entities/event/participationApi.ts

import { apiClient } from '@/shared/api/client';

// ---- Типы из реального ответа API ----

export interface IParticipantAccount {
  id: string;
  login: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  registrationDate: string;
  lastSeenDate: string | null;
  lastActionDate: string | null;
  walletId: string | null;
}

export interface IParticipantPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: 'Male' | 'Female' | null;
  birthDate: string | null;
}

export interface IParticipant {
  account: IParticipantAccount;
  personInfo: IParticipantPersonInfo | null;
}

// Плоская модель для отображения (после нормализации)
export interface IParticipantView {
  accountId: string;
  login: string;
  firstName: string | null;
  lastName: string | null;
}

export async function participateEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/participate/${eventId}`);
}

export async function leaveEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/leave/${eventId}`);
}

export async function fetchEventParticipants(eventId: string): Promise<IParticipantView[]> {
  const data = await apiClient.get<IParticipant[]>(
    `/api/participations/eventParticipants/${eventId}`
  );
  const result = data.result;
  if (!result || !Array.isArray(result)) return [];

  return result.map(p => ({
    accountId: p.account.id,
    login:     p.account.login,
    firstName: p.personInfo?.firstName ?? null,
    lastName:  p.personInfo?.lastName  ?? null,
  }));
}
