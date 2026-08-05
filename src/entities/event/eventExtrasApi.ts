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
  /** Продажа билетов на мероприятие */
  ticketsEnabled: boolean;
}

export interface IAssignEventParametersRequest {
  cost: number;
  private: boolean;
  maxPersonsCount?: number | null;
  ageLimit?: number | null;
  allowedGender?: Gender | null;
  allowUsersToInvite: boolean;
  ticketsEnabled: boolean;
}

/**
 * POST /api/events/eventParameters/assignToEvent/{eventId}
 */
export async function assignEventParameters(
  eventId: string,
  payload: IAssignEventParametersRequest,
): Promise<void> {
  await apiClient.post(`/api/events/eventParameters/assignToEvent/${eventId}`, payload);
}

/**
 * POST /api/events/eventTypes/assignToEvent/{eventId}
 */
export async function assignEventTypes(eventId: string, eventTypeIds: string[]): Promise<void> {
  if (eventTypeIds.length === 0) return;
  await apiClient.post(`/api/events/eventTypes/assignToEvent/${eventId}`, eventTypeIds);
}

/**
 * POST /api/EventOrganizators/assign
 * Тело: EventOrganizatorsListRequest { accountIds, organizationIds, eventId }
 */
export interface IEventOrganizatorsAssignRequest {
  eventId: string;
  accountIds: string[];
  organizationIds: string[];
}

export async function assignEventOrganizators(
  payload: IEventOrganizatorsAssignRequest,
): Promise<void> {
  await apiClient.post('/api/EventOrganizators/assign', {
    eventId: payload.eventId,
    accountIds: payload.accountIds,
    organizationIds: payload.organizationIds,
  });
}

/**
 * GET /api/events/eventParameters/byEvent/{eventId}
 */
export async function fetchEventParameters(eventId: string): Promise<IEventParameters | null> {
  try {
    const data = await apiClient.get<IEventParameters>(
      `/api/events/eventParameters/byEvent/${eventId}`
    );
    const raw = data.result as (IEventParameters & Record<string, unknown>) | null;
    if (!raw) return null;

    // API может отдать camelCase или PascalCase
    const ageRaw = raw.ageLimit ?? raw.AgeLimit;
    const ageLimit =
      ageRaw == null || ageRaw === ''
        ? null
        : typeof ageRaw === 'number'
          ? ageRaw
          : Number(ageRaw);

    return {
      id: String(raw.id ?? raw.Id ?? ''),
      cost: Number(raw.cost ?? raw.Cost ?? 0),
      private: Boolean(raw.private ?? raw.Private ?? false),
      maxPersonsCount: (raw.maxPersonsCount ?? raw.MaxPersonsCount ?? null) as number | null,
      ageLimit: ageLimit != null && Number.isFinite(ageLimit) ? ageLimit : null,
      allowedGender: (raw.allowedGender ?? raw.AllowedGender ?? null) as IEventParameters['allowedGender'],
      allowUsersToInvite: Boolean(raw.allowUsersToInvite ?? raw.AllowUsersToInvite ?? true),
      ticketsEnabled: Boolean(raw.ticketsEnabled ?? raw.TicketsEnabled ?? false),
    };
  } catch {
    return null;
  }
}

// ---- EventOrganizators ----

// Реальная структура ответа API
interface IOrganizatorAccount {
  id: string;
  login: string;
  avatarId?: string | null;
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

interface IOrganizatorOrganization {
  id: string;
  name: string;
  active?: boolean;
  description?: string | null;
}

interface IRawOrganizator {
  id: string;
  eventId: string;
  account: IOrganizatorAccount | null;
  personInfo: IOrganizatorPersonInfo | null;
  organization: IOrganizatorOrganization | null;
  organizationId: string | null;
}

/** Плоская модель для отображения (person и/или organization) */
export interface IEventOrganizator {
  id: string;
  accountId: string | null;
  login: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarId?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
}

/**
 * GET /api/EventOrganizators/getByEventId/{eventId}
 */
export async function fetchEventOrganizators(eventId: string): Promise<IEventOrganizator[]> {
  const data = await apiClient.get<IRawOrganizator[]>(
    `/api/EventOrganizators/getByEventId/${eventId}`
  );
  return (data.result ?? []).map(o => {
    const orgId = o.organizationId ?? o.organization?.id ?? null;
    return {
      id: o.id,
      accountId: o.account?.id ?? null,
      login: o.account?.login ?? null,
      firstName: o.personInfo?.firstName ?? null,
      lastName: o.personInfo?.lastName ?? null,
      avatarId: o.account?.avatarId ?? null,
      organizationId: orgId,
      organizationName: o.organization?.name ?? null,
    };
  });
}

/**
 * GET /api/EventOrganizators/isOrganizator/{eventId}
 * BooleanCommandResult — учитывает и личное членство, и роль в организации-организаторе.
 */
export async function checkIsEventOrganizator(eventId: string): Promise<boolean> {
  try {
    const data = await apiClient.get<boolean>(
      `/api/EventOrganizators/isOrganizator/${eventId}`,
    );
    return Boolean(data.result);
  } catch {
    return false;
  }
}
