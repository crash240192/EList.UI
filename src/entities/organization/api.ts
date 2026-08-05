// entities/organization/api.ts

import { apiClient } from '@/shared/api/client';
import type {
  AddOrganizationMemberRequest,
  OrganizationLegalRequest,
  OrganizationLegalResponse,
  OrganizationMemberResponse,
  OrganizationPayoutRequest,
  OrganizationPayoutResponse,
  OrganizationRequest,
  OrganizationResponse,
  TransferOwnershipRequest,
} from './types';

/** POST /api/organizations/create → organizationId */
export async function createOrganization(payload: OrganizationRequest): Promise<string> {
  const r = await apiClient.post<string | null>('/api/organizations/create', payload);
  if (!r.result) throw new Error(r.message || 'Не удалось создать организацию');
  return r.result;
}

/** GET /api/organizations/my */
export async function fetchMyOrganizations(): Promise<OrganizationResponse[]> {
  const r = await apiClient.get<OrganizationResponse[]>('/api/organizations/my');
  return r.result ?? [];
}

/**
 * GET /api/organizations/byAccount/{accountId}
 * Организации, в которых состоит указанный аккаунт (публичный профиль).
 */
export async function fetchOrganizationsByAccount(
  accountId: string,
): Promise<OrganizationResponse[]> {
  const r = await apiClient.get<OrganizationResponse[]>(
    `/api/organizations/byAccount/${accountId}`,
  );
  return r.result ?? [];
}

/** GET /api/organizations/get/{organizationId} */
export async function fetchOrganizationById(organizationId: string): Promise<OrganizationResponse> {
  const r = await apiClient.get<OrganizationResponse>(`/api/organizations/get/${organizationId}`);
  return r.result;
}

/** PUT /api/organizations/update/{organizationId} */
export async function updateOrganization(
  organizationId: string,
  payload: OrganizationRequest,
): Promise<void> {
  await apiClient.put(`/api/organizations/update/${organizationId}`, payload);
}

/** PUT /api/organizations/setActive/{organizationId}?active= */
export async function setOrganizationActive(
  organizationId: string,
  active: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/organizations/setActive/${organizationId}?active=${active ? 'true' : 'false'}`,
    {},
  );
}

/** GET /api/organizations/members/{organizationId} */
export async function fetchOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMemberResponse[]> {
  const r = await apiClient.get<OrganizationMemberResponse[]>(
    `/api/organizations/members/${organizationId}`,
  );
  return r.result ?? [];
}

/** POST /api/organizations/managers/add/{organizationId} */
export async function addOrganizationManager(
  organizationId: string,
  payload: AddOrganizationMemberRequest,
): Promise<void> {
  await apiClient.post(`/api/organizations/managers/add/${organizationId}`, payload);
}

/** DELETE /api/organizations/members/remove/{organizationId}/{accountId} */
export async function removeOrganizationMember(
  organizationId: string,
  accountId: string,
): Promise<void> {
  await apiClient.delete(`/api/organizations/members/remove/${organizationId}/${accountId}`);
}

/** PUT /api/organizations/members/setActive/{organizationId}/{accountId}?active= */
export async function setOrganizationMemberActive(
  organizationId: string,
  accountId: string,
  active: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/organizations/members/setActive/${organizationId}/${accountId}?active=${active ? 'true' : 'false'}`,
    {},
  );
}

/** POST /api/organizations/transferOwnership/{organizationId} */
export async function transferOrganizationOwnership(
  organizationId: string,
  payload: TransferOwnershipRequest,
): Promise<void> {
  await apiClient.post(`/api/organizations/transferOwnership/${organizationId}`, payload);
}

/** GET /api/organizations/legal/{organizationId} */
export async function fetchOrganizationLegal(
  organizationId: string,
): Promise<OrganizationLegalResponse | null> {
  try {
    const r = await apiClient.get<OrganizationLegalResponse>(
      `/api/organizations/legal/${organizationId}`,
    );
    return r.result ?? null;
  } catch {
    return null;
  }
}

/** PUT /api/organizations/legal/{organizationId} */
export async function saveOrganizationLegal(
  organizationId: string,
  payload: OrganizationLegalRequest,
): Promise<void> {
  await apiClient.put(`/api/organizations/legal/${organizationId}`, payload);
}

/** GET /api/organizations/payout/{organizationId} */
export async function fetchOrganizationPayout(
  organizationId: string,
): Promise<OrganizationPayoutResponse | null> {
  try {
    const r = await apiClient.get<OrganizationPayoutResponse>(
      `/api/organizations/payout/${organizationId}`,
    );
    return r.result ?? null;
  } catch {
    return null;
  }
}

/** PUT /api/organizations/payout/{organizationId} */
export async function saveOrganizationPayout(
  organizationId: string,
  payload: OrganizationPayoutRequest,
): Promise<void> {
  await apiClient.put(`/api/organizations/payout/${organizationId}`, payload);
}

/** POST /api/organizations/verification/submit/{organizationId} */
export async function submitOrganizationVerification(organizationId: string): Promise<void> {
  await apiClient.post(`/api/organizations/verification/submit/${organizationId}`, {});
}

/** PUT /api/organizations/tickets/setEnabled/{organizationId}?enabled= */
export async function setOrganizationTicketsEnabled(
  organizationId: string,
  enabled: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/organizations/tickets/setEnabled/${organizationId}?enabled=${enabled ? 'true' : 'false'}`,
    {},
  );
}
