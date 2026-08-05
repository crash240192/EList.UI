// entities/invitation/invitationsApi.ts

import { apiClient } from '@/shared/api/client';
import type { IEventType } from '@/entities/event/types';
import { normalizeEventListItem } from '@/entities/event/normalizeEventListItem';
import { fetchEventTypes } from '@/entities/event/api';
import { fetchEventTypesByEvent } from '@/entities/event/participationApi';
import { parseInvitationViewed } from './invitationViewed';

export interface IInvitationEvent {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  address: string | null;
  coverImageId: string | null;
  coverUrl?: string | null;
  eventTypes?: IEventType[];
  eventType?: IEventType | null;
  parameters?: {
    cost?: number;
    ageLimit?: number | null;
    maxPersonsCount?: number | null;
    private?: boolean;
  } | null;
  participantsCount?: number | null;
  colors?: string[];
}

export interface IInviter {
  account: { id: string; login: string; avatarId: string | null };
  personInfo: { firstName: string | null; lastName: string | null } | null;
}

export interface IInvitation {
  id: string;
  inviterAccountId: string;
  invitedAccountId: string;
  /** Организация-приглашающий (если мероприятие от организации) */
  inviterOrganizationId: string | null;
  eventId: string;
  creationDate: string;
  /** false — приглашение ещё не просмотрено */
  viewed: boolean;
  inviter: IInviter;
  event: IInvitationEvent;
}

function normalizeAccount(raw: unknown): IInviter['account'] {
  const a = (raw ?? {}) as Record<string, unknown>;
  const avatar = a.avatarId ?? a.AvatarId;
  return {
    id: String(a.id ?? a.Id ?? ''),
    login: String(a.login ?? a.Login ?? ''),
    avatarId: avatar != null && avatar !== '' ? String(avatar) : null,
  };
}

function normalizePersonInfo(raw: unknown): IInviter['personInfo'] {
  if (!raw) return null;
  const p = raw as Record<string, unknown>;
  return {
    firstName: (p.firstName ?? p.FirstName ?? null) as string | null,
    lastName: (p.lastName ?? p.LastName ?? null) as string | null,
  };
}

function normalizeInviter(raw: unknown): IInviter {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    account: normalizeAccount(r.account ?? r.Account),
    personInfo: normalizePersonInfo(r.personInfo ?? r.PersonInfo),
  };
}

function normalizeEvent(raw: unknown): IInvitationEvent {
  const base = normalizeEventListItem(raw);
  const e = (raw ?? {}) as Record<string, unknown>;
  const rawParams = (e.parameters ?? e.Parameters ?? null) as Record<string, unknown> | null;

  return {
    ...base,
    startTime: base.startTime ?? '',
    endTime: String(e.endTime ?? e.EndTime ?? ''),
    address: base.address ?? null,
    coverImageId: base.coverImageId ?? null,
    parameters: base.parameters
      ? {
          ...base.parameters,
          private: !!(rawParams?.private ?? rawParams?.Private),
        }
      : null,
  };
}

function normalizeInvitation(raw: Record<string, unknown>): IInvitation {
  const inviter = raw.inviter ?? raw.Inviter;
  const event = raw.event ?? raw.Event;
  const orgRaw = raw.inviterOrganizationId ?? raw.InviterOrganizationId;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    inviterAccountId: String(raw.inviterAccountId ?? raw.InviterAccountId ?? ''),
    invitedAccountId: String(raw.invitedAccountId ?? raw.InvitedAccountId ?? ''),
    inviterOrganizationId: orgRaw != null && orgRaw !== '' ? String(orgRaw) : null,
    eventId: String(raw.eventId ?? raw.EventId ?? ''),
    creationDate: String(raw.creationDate ?? raw.CreationDate ?? ''),
    viewed: parseInvitationViewed(raw.viewed ?? raw.Viewed),
    inviter: normalizeInviter(inviter),
    event: normalizeEvent(event),
  };
}

export interface ICreateInvitationRequest {
  accountIds: string[];
  eventId: string;
  /** Аккаунт, от имени которого отправлено (хронология «кто пригласил») */
  inviterAccountId?: string;
  /** Организация-организатор мероприятия — приглашение от её имени */
  inviterOrganizationId?: string | null;
}

/** POST /api/invitations/search */
export interface IInvitationsSearchRequest {
  inviterAccountIds?: string[];
  invitedAccountIds?: string[];
  inviterOrgIds?: string[];
  eventIds?: string[];
  viewed?: boolean;
  pageSize?: number;
  pageIndex?: number;
}

export async function createInvitations(req: ICreateInvitationRequest): Promise<void> {
  await apiClient.post('/api/invitations/create', req);
}

function parseInvitationPaged(
  payload: unknown,
): { result: IInvitation[]; total: number } {
  if (!payload) return { result: [], total: 0 };

  // Иногда API отдаёт массив напрямую
  if (Array.isArray(payload)) {
    const list = payload.map(row => normalizeInvitation(row as Record<string, unknown>));
    return { result: list, total: list.length };
  }

  const p = payload as Record<string, unknown>;
  const rawList = p.result ?? p.Result;
  const list = Array.isArray(rawList) ? rawList : [];
  const normalized = list.map(row => normalizeInvitation(row as Record<string, unknown>));
  const totalRaw = p.total ?? p.Total;
  return {
    result: normalized,
    total: typeof totalRaw === 'number' ? totalRaw : list.length,
  };
}

export async function fetchUserInvitations(pageIndex = 0, pageSize = 20): Promise<{ result: IInvitation[]; total: number }> {
  const r = await apiClient.get<unknown>(
    `/api/invitations/userInvitations?pageIndex=${pageIndex}&pageSize=${pageSize}`
  );
  const parsed = parseInvitationPaged(r.result);
  const enriched = await enrichInvitationsWithEventTypes(parsed.result);
  return { result: enriched, total: parsed.total };
}

/**
 * Поиск приглашений.
 * Для «Отправленных» передаём inviterAccountIds: [currentAccountId].
 */
export async function searchInvitations(
  req: IInvitationsSearchRequest = {},
): Promise<{ result: IInvitation[]; total: number }> {
  const r = await apiClient.post<unknown>('/api/invitations/search', {
    pageIndex: 0,
    pageSize: 50,
    ...req,
  });
  const parsed = parseInvitationPaged(r.result);
  const enriched = await enrichInvitationsWithEventTypes(parsed.result);
  return { result: enriched, total: parsed.total };
}

/** GET /api/invitations/cancel?invitationId= */
export async function cancelInvitation(invitationId: string): Promise<void> {
  await apiClient.get(`/api/invitations/cancel?invitationId=${invitationId}`);
}

/** Подгружает типы мероприятий, если их нет во вложенном event */
export async function enrichInvitationsWithEventTypes(invitations: IInvitation[]): Promise<IInvitation[]> {
  const missing = invitations.filter(inv => !inv.event.eventTypes?.length);
  if (missing.length === 0) return invitations;

  const eventIds = [...new Set(missing.map(inv => inv.eventId))];
  const allTypes = await fetchEventTypes().catch(() => []);
  const typeById = new Map(allTypes.map(t => [t.id, t]));

  const typesByEvent = new Map<string, IEventType[]>();
  await Promise.all(eventIds.map(async eventId => {
    const refs = await fetchEventTypesByEvent(eventId);
    const types = refs
      .map(ref => typeById.get(ref.id))
      .filter((t): t is IEventType => !!t);
    typesByEvent.set(eventId, types);
  }));

  return invitations.map(inv => {
    if (inv.event.eventTypes?.length) return inv;
    const types = typesByEvent.get(inv.eventId) ?? [];
    if (types.length === 0) return inv;
    return {
      ...inv,
      event: {
        ...inv.event,
        eventTypes: types,
        eventType: types[0] ?? null,
      },
    };
  });
}

/** GET /api/invitations/notViewedCount */
export async function fetchNotViewedInvitationsCount(): Promise<number> {
  const r = await apiClient.get<number | { count?: number; notViewedCount?: number }>(
    '/api/invitations/notViewedCount',
  );
  const val = r.result;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.floor(val));
  if (val && typeof val === 'object') {
    const n = (val as { count?: number; notViewedCount?: number }).count
      ?? (val as { notViewedCount?: number }).notViewedCount;
    if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/** GET /api/invitations/markViewed/{invitationId} */
export async function markInvitationViewed(invitationId: string): Promise<void> {
  await apiClient.get(`/api/invitations/markViewed/${invitationId}`);
}

/** GET /api/invitations/markViewed/all */
export async function markAllInvitationsViewed(): Promise<void> {
  await apiClient.get('/api/invitations/markViewed/all');
}
