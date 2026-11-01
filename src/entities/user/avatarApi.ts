// entities/user/avatarApi.ts

import { apiClient } from '@/shared/api/client';
import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import {
  clampAvatarZoom,
  clampFocus01,
  normalizeAvatarCropFrame,
  type AvatarCropFrame,
} from '@/shared/ui/AvatarUpload/cropAvatar';

export interface IAvatarInfo {
  photoId: string;
  fileId:  string;
}

/** Контекст обрезанного аватара: исходник + последний кадр (zoom/focus). */
export interface AvatarCropFileMeta {
  sourceFileId: string;
  frame: AvatarCropFrame;
}

const SOURCE_KEY = 'avatarSourceId';
const ZOOM_KEY = 'avatarZoom';
const FOCUS_X_KEY = 'avatarFocusX';
const FOCUS_Y_KEY = 'avatarFocusY';

export function parseAvatarCropContext(description: string | null | undefined): AvatarCropFileMeta | null {
  if (!description) return null;
  try {
    const data = JSON.parse(description) as Record<string, unknown>;
    const raw = data[SOURCE_KEY] ?? data.AvatarSourceId;
    if (typeof raw !== 'string') return null;
    const sourceFileId = raw.trim();
    if (!sourceFileId) return null;
    return {
      sourceFileId,
      frame: normalizeAvatarCropFrame({
        zoom: clampAvatarZoom(data[ZOOM_KEY] ?? data.AvatarZoom),
        focusX: clampFocus01(data[FOCUS_X_KEY] ?? data.AvatarFocusX),
        focusY: clampFocus01(data[FOCUS_Y_KEY] ?? data.AvatarFocusY),
      }),
    };
  } catch {
    return null;
  }
}

export function serializeAvatarCropContext(meta: AvatarCropFileMeta): string {
  const frame = normalizeAvatarCropFrame(meta.frame);
  return JSON.stringify({
    [SOURCE_KEY]: meta.sourceFileId,
    [ZOOM_KEY]: clampAvatarZoom(frame.zoom),
    [FOCUS_X_KEY]: clampFocus01(frame.focusX),
    [FOCUS_Y_KEY]: clampFocus01(frame.focusY),
  });
}

/** Мета кадра: исходник и последние zoom/focus (если сохраняли). */
export async function loadAvatarCropMeta(cropFileId: string): Promise<AvatarCropFileMeta | null> {
  const info = await getFileInfo(cropFileId);
  return parseAvatarCropContext(info?.description);
}

/** @deprecated используйте loadAvatarCropMeta */
export async function loadAvatarSourceFileId(cropFileId: string): Promise<string | null> {
  return (await loadAvatarCropMeta(cropFileId))?.sourceFileId ?? null;
}

/** Пишем исходник + кадр в описание обрезанного файла (attach заменяет описание целиком). */
export async function saveAvatarCropMeta(
  cropFileId: string,
  sourceFileId: string,
  frame: AvatarCropFrame,
): Promise<void> {
  await attachFileContext(
    cropFileId,
    serializeAvatarCropContext({ sourceFileId, frame: normalizeAvatarCropFrame(frame) }),
  );
}

/** @deprecated используйте saveAvatarCropMeta */
export async function saveAvatarSourceLink(cropFileId: string, sourceFileId: string): Promise<void> {
  await saveAvatarCropMeta(cropFileId, sourceFileId, normalizeAvatarCropFrame(null));
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
