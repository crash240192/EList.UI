// entities/organization/avatarApi.ts

import { apiClient } from '@/shared/api/client';

/** GET /api/media/organization/avatar/getByOrganizationId/{organizationId} */
export async function getOrganizationAvatar(organizationId: string): Promise<string | null> {
  try {
    const r = await apiClient.get<string | null>(
      `/api/media/organization/avatar/getByOrganizationId/${organizationId}`,
    );
    return r.result ?? null;
  } catch {
    return null;
  }
}

/** GET /api/media/organization/avatars/setNew?organizationId=&photoId= */
export async function setOrganizationAvatar(
  organizationId: string,
  photoId: string,
): Promise<void> {
  await apiClient.get(
    `/api/media/organization/avatars/setNew?organizationId=${encodeURIComponent(organizationId)}&photoId=${encodeURIComponent(photoId)}`,
  );
}

/** GET /api/media/organization/avatars/getByOrganizationId/{organizationId} */
export async function getOrganizationAvatarHistory(organizationId: string): Promise<string[]> {
  try {
    const r = await apiClient.get<string[]>(
      `/api/media/organization/avatars/getByOrganizationId/${organizationId}`,
    );
    return r.result ?? [];
  } catch {
    return [];
  }
}
