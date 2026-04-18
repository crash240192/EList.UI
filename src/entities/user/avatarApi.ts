// entities/user/avatarApi.ts

import { apiClient } from '@/shared/api/client';

export interface IAvatarInfo {
  photoId: string;
  fileId:  string;
}

/** GET /api/media/account/avatar — текущий аватар своего аккаунта */
export async function getMyAvatarFileId(): Promise<string | null> {
  try {
    const r = await apiClient.get<string>('/api/media/account/avatar');
    // result — просто строка UUID
    return (typeof r.result === 'string' && r.result) ? r.result : null;
  } catch { return null; }
}

/** GET /api/media/account/avatar/{accountId} — аватар любого пользователя */
export async function getAvatarFileId(accountId: string): Promise<string | null> {
  try {
    const r = await apiClient.get<string>(`/api/media/account/avatar/${accountId}`);
    return (typeof r.result === 'string' && r.result) ? r.result : null;
  } catch { return null; }
}

/** GET /api/media/account/avatars/setNew/{photoId} — назначить новый аватар */
export async function setAvatar(fileId: string): Promise<void> {
  await apiClient.get(`/api/media/account/avatars/setNew/${fileId}`);
}

/** GET /api/media/account/avatars/{accountId} — история аватаров пользователя */
export async function getAvatarHistory(accountId: string): Promise<IAvatarInfo[]> {
  try {
    const r = await apiClient.get<IAvatarInfo[]>(`/api/media/account/avatars/${accountId}`);
    return r.result ?? [];
  } catch { return []; }
}
