// entities/invitation/invitationsApi.ts

import { apiClient } from '@/shared/api/client';
import { parseInvitationViewed } from './invitationViewed';

export interface IInvitationEvent {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  address: string | null;
  coverImageId: string | null;
}

export interface IInviter {
  account: { id: string; login: string };
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
    inviter: inviter as IInvitation['inviter'],
    event: event as IInvitation['event'],
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
  return {
    result: list.map(row => normalizeInvitation(row as unknown as Record<string, unknown>)),
    total: typeof payload.total === 'number' ? payload.total : list.length,
  };
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
