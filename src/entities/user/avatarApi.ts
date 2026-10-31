// entities/user/avatarApi.ts

import { apiClient } from '@/shared/api/client';
import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';

export interface IAvatarInfo {
  photoId: string;
  fileId:  string;
}

/** Контекст обрезанного аватара: id исходного файла для повторного кадра. */
export interface AvatarCropFileMeta {
  sourceFileId: string;
}

const SOURCE_KEY = 'avatarSourceId';

export function parseAvatarCropContext(description: string | null | undefined): AvatarCropFileMeta | null {
  if (!description) return null;
  try {
    const data = JSON.parse(description) as Record<string, unknown>;
    const raw = data[SOURCE_KEY] ?? data.AvatarSourceId;
    if (typeof raw !== 'string') return null;
    const sourceFileId = raw.trim();
    if (!sourceFileId) return null;
    return { sourceFileId };
  } catch {
    return null;
  }
}

export function serializeAvatarCropContext(meta: AvatarCropFileMeta): string {
  return JSON.stringify({ [SOURCE_KEY]: meta.sourceFileId });
}

/** Исходник, с которого собран текущий квадрат аватара (если сохраняли кадр). */
export async function loadAvatarSourceFileId(cropFileId: string): Promise<string | null> {
  const info = await getFileInfo(cropFileId);
  return parseAvatarCropContext(info?.description)?.sourceFileId ?? null;
}

/** Пишем ссылку на исходник в описание обрезанного файла (attach заменяет описание целиком). */
export async function saveAvatarSourceLink(cropFileId: string, sourceFileId: string): Promise<void> {
  await attachFileContext(cropFileId, serializeAvatarCropContext({ sourceFileId }));
}

/** GET /api/media/account/avatars/setNew/{photoId} — назначить новый аватар */
export async function setAvatar(fileId: string): Promise<void> {
  await apiClient.get(`/api/media/account/avatars/setNew/${fileId}`);
}

/** DELETE /api/media/account/avatars/delete/{fileId} — удалить аватар из истории */
export async function deleteAvatar(fileId: string): Promise<void> {
  await apiClient.delete(`/api/media/account/avatars/delete/${fileId}`);
}

/** GET /api/media/account/avatars/{accountId} — история аватаров (просмотр на странице пользователя) */
export async function getAvatarHistory(accountId: string): Promise<IAvatarInfo[]> {
  try {
    const r = await apiClient.get<IAvatarInfo[]>(`/api/media/account/avatars/getByAccountId/${accountId}`);
    return r.result ?? [];
  } catch { return []; }
}
