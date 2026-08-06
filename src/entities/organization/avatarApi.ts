// entities/organization/avatarApi.ts

import { apiClient } from '@/shared/api/client';

function normalizeFileId(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const id = o.fileId ?? o.FileId ?? o.id ?? o.Id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

/** GET /api/media/organization/avatar/getByOrganizationId/{organizationId} */
export async function getOrganizationAvatar(organizationId: string): Promise<string | null> {
  try {
    const r = await apiClient.get<unknown>(
      `/api/media/organization/avatar/getByOrganizationId/${organizationId}`,
    );
    return normalizeFileId(r.result);
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
    const r = await apiClient.get<unknown>(
      `/api/media/organization/avatars/getByOrganizationId/${organizationId}`,
    );
    const list = r.result;
    if (!Array.isArray(list)) return [];
    return list
      .map(item => (typeof item === 'string' ? item : normalizeFileId(item)))
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}
