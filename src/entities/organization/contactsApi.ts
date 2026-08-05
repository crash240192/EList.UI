// entities/organization/contactsApi.ts
// Контакты организации — зеркало пользовательских /api/contacts/*

import { apiClient } from '@/shared/api/client';
import type { IContactDataItem } from '@/entities/user/profileApi';
import type { IContactRequest } from '@/entities/user/settingsApi';

/** POST /api/contacts/organization/{organizationId}/create */
export async function createOrganizationContact(
  organizationId: string,
  payload: IContactRequest,
): Promise<void> {
  await apiClient.post(`/api/contacts/organization/${organizationId}/create`, payload);
}

/** PUT /api/contacts/organization/update/{id} */
export async function updateOrganizationContact(
  id: string,
  payload: IContactRequest,
): Promise<void> {
  await apiClient.put(`/api/contacts/organization/update/${id}`, payload);
}

/** GET /api/contacts/organization/{organizationId}/getAll */
export async function fetchOrganizationContacts(
  organizationId: string,
): Promise<IContactDataItem[]> {
  try {
    const r = await apiClient.get<IContactDataItem[]>(
      `/api/contacts/organization/${organizationId}/getAll`,
    );
    return r.result ?? [];
  } catch {
    return [];
  }
}
