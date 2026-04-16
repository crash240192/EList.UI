// entities/event/eventExtrasApi.ts
// Дополнительные данные события: параметры и организаторы

import { apiClient } from '@/shared/api/client';
import type { Gender } from '@/shared/api/types';

// ---- EventParameters ----

export interface IEventParameters {
  id: string;
  cost: number;
  private: boolean;
  maxPersonsCount: number | null;
  ageLimit: number | null;
  allowedGender: Gender | null;
  allowUsersToInvite: boolean;
}

/**
 * GET /api/events/eventParameters/byEvent/{eventId}
 */
export async function fetchEventParameters(eventId: string): Promise<IEventParameters | null> {
  try {
    const data = await apiClient.get<IEventParameters>(
      `/api/events/eventParameters/byEvent/${eventId}`
    );
    return data.result ?? null;
  } catch {
    return null;
  }
}

// ---- EventOrganizators ----

// Реальная структура ответа API
interface IOrganizatorAccount {
  id: string;
  login: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface IOrganizatorPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: 'Male' | 'Female' | null;
  birthDate: string | null;
}

interface IRawOrganizator {
  id: string;
  eventId: string;
  account: IOrganizatorAccount;
  personInfo: IOrganizatorPersonInfo | null;
  organizationId: string | null;
}

// Плоская модель для отображения
export interface IEventOrganizator {
  accountId: string;
  login: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * GET /api/EventOrganizators/getByEventId/{eventId}
 */
export async function fetchEventOrganizators(eventId: string): Promise<IEventOrganizator[]> {
  try {
    const data = await apiClient.get<IRawOrganizator[]>(
      `/api/EventOrganizators/getByEventId/${eventId}`
    );
    return (data.result ?? []).map(o => ({
      accountId: o.account.id,
      login:     o.account.login,
      firstName: o.personInfo?.firstName ?? null,
      lastName:  o.personInfo?.lastName  ?? null,
    }));
  } catch {
    return [];
  }
}
