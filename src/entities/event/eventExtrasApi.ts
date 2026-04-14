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

export interface IEventOrganizator {
  accountId: string;
  login: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * GET /api/EventOrganizators/getByEventId/{eventId}
 * Не найден в Swagger — реализован по описанию задачи.
 */
export async function fetchEventOrganizators(eventId: string): Promise<IEventOrganizator[]> {
  try {
    const data = await apiClient.get<IEventOrganizator[]>(
      `/api/EventOrganizators/getByEventId/${eventId}`
    );
    return data.result ?? [];
  } catch {
    return [];
  }
}
