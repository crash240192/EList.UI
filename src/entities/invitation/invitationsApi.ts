// entities/invitation/invitationsApi.ts

import { apiClient } from '@/shared/api/client';
import type { IEventType } from '@/entities/event/types';
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
  eventTypes?: IEventType[];
  eventType?: IEventType | null;
  parameters?: {
    cost?: number;
    ageLimit?: number | null;
    maxPersonsCount?: number | null;
    private?: boolean;
  } | null;
  participantsCount?: number | null;
}

export interface IInviter {
  account: { id: string; login: string; avatarId: string | null };
  personInfo: { firstName: string | null; lastName: string | null } | null;
}

export interface IInvitation {
  id: string;
  inviterAccountId: string;
  invitedAccountId: string;
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

function normalizeEventCategory(raw: unknown): IEventType['eventCategory'] {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  return {
    id: String(c.id ?? c.Id ?? ''),
    name: String(c.name ?? c.Name ?? ''),
    namePath: String(c.namePath ?? c.NamePath ?? ''),
    ico: (c.ico ?? c.Ico ?? null) as string | null,
    description: (c.description ?? c.Description ?? null) as string | null,
    color: (c.color ?? c.Color ?? null) as string | null,
  };
}

function normalizeEventType(raw: unknown): IEventType | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const id = String(t.id ?? t.Id ?? '');
  if (!id) return null;
  const cat = t.eventCategory ?? t.EventCategory;
  return {
    id,
    name: String(t.name ?? t.Name ?? ''),
    namePath: String(t.namePath ?? t.NamePath ?? ''),
    description: (t.description ?? t.Description ?? null) as string | null,
    ico: (t.ico ?? t.Ico ?? null) as string | null,
    eventCategoryId: String(t.eventCategoryId ?? t.EventCategoryId ?? (cat as any)?.id ?? ''),
    eventCategory: normalizeEventCategory(cat),
  };
}

function normalizeEventTypes(raw: unknown): IEventType[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEventType).filter((t): t is IEventType => t != null);
}

function normalizeEvent(raw: unknown): IInvitationEvent {
  const e = (raw ?? {}) as Record<string, unknown>;
  const types = normalizeEventTypes(e.Types ?? e.types ?? e.eventTypes);
  const single = normalizeEventType(e.eventType ?? e.EventType) ?? types[0] ?? null;
  const params = (e.parameters ?? e.Parameters ?? null) as Record<string, unknown> | null;

  return {
    id: String(e.id ?? e.Id ?? ''),
    name: String(e.name ?? e.Name ?? ''),
    startTime: String(e.startTime ?? e.StartTime ?? ''),
    endTime: String(e.endTime ?? e.EndTime ?? ''),
    address: (e.address ?? e.Address ?? null) as string | null,
    coverImageId: (e.coverImageId ?? e.CoverImageId ?? null) as string | null,
    eventTypes: types.length > 0 ? types : single ? [single] : [],
    eventType: single,
    parameters: params
      ? {
          cost: (params.cost ?? params.Cost ?? 0) as number,
          ageLimit: (params.ageLimit ?? params.AgeLimit ?? null) as number | null,
          maxPersonsCount: (params.maxPersonsCount ?? params.MaxPersonsCount ?? null) as number | null,
          private: !!(params.private ?? params.Private),
        }
      : null,
    participantsCount: (e.participantsCount ?? e.ParticipantsCount ?? null) as number | null,
  };
}

function normalizeInvitation(raw: Record<string, unknown>): IInvitation {
  const inviter = raw.inviter ?? raw.Inviter;
  const event = raw.event ?? raw.Event;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    inviterAccountId: String(raw.inviterAccountId ?? raw.InviterAccountId ?? ''),
    invitedAccountId: String(raw.invitedAccountId ?? raw.InvitedAccountId ?? ''),
    eventId: String(raw.eventId ?? raw.EventId ?? ''),
    creationDate: String(raw.creationDate ?? raw.CreationDate ?? ''),
    viewed: parseInvitationViewed(raw.viewed ?? raw.Viewed),
    inviter: normalizeInviter(inviter),
    event: normalizeEvent(event),
  };
}

export interface ICreateInvitationRequest {
  accountIds: string[];
  inviterOrganizationId?: string;
  eventId: string;
}

export async function createInvitations(req: ICreateInvitationRequest): Promise<void> {
  await apiClient.post('/api/invitations/create', req);
}

export async function fetchUserInvitations(pageIndex = 0, pageSize = 20): Promise<{ result: IInvitation[]; total: number }> {
  const r = await apiClient.get<{ result: IInvitation[]; total: number }>(
    `/api/invitations/userInvitations?pageIndex=${pageIndex}&pageSize=${pageSize}`
  );
  const payload = r.result;
  if (!payload) return { result: [], total: 0 };
  const list = Array.isArray(payload.result) ? payload.result : [];
  const normalized = list.map(row => normalizeInvitation(row as unknown as Record<string, unknown>));
  const enriched = await enrichInvitationsWithEventTypes(normalized);
  return {
    result: enriched,
    total: typeof payload.total === 'number' ? payload.total : list.length,
  };
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
