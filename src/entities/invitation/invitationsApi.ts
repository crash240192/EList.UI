// entities/invitation/invitationsApi.ts

import { apiClient } from '@/shared/api/client';

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
  inviter: IInviter;
  event: IInvitationEvent;
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
  return r.result;
}
