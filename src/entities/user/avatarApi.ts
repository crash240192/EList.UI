// entities/user/avatarApi.ts

import { apiClient } from '@/shared/api/client';

export interface IAvatarInfo {
  photoId: string;
  fileId:  string;
}

/** GET /api/media/account/avatars/setNew/{photoId} — назначить новый аватар */
export async function setAvatar(fileId: string): Promise<void> {
  await apiClient.get(`/api/media/account/avatars/setNew/${fileId}`);
}

/** GET /api/media/account/avatars/{accountId} — история аватаров (просмотр на странице пользователя) */
export async function getAvatarHistory(accountId: string): Promise<IAvatarInfo[]> {
  try {
    const r = await apiClient.get<IAvatarInfo[]>(`/api/media/account/avatars/${accountId}`);
    return r.result ?? [];
  } catch { return []; }
}
