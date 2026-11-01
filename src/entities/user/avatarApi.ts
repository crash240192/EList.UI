// entities/user/avatarApi.ts

import { useEffect, useState, type CSSProperties } from 'react';
import { apiClient } from '@/shared/api/client';
import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import { coverFocusImgStyle, type CoverFocus } from '@/shared/lib/coverFocus';
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

/** Контекст аватара: исходник + кадр (zoom/focus). Новая модель: avatarId = исходник. */
export interface AvatarCropFileMeta {
  sourceFileId: string;
  frame: AvatarCropFrame;
}

const SOURCE_KEY = 'avatarSourceId';
const ZOOM_KEY = 'avatarZoom';
const FOCUS_X_KEY = 'avatarFocusX';
const FOCUS_Y_KEY = 'avatarFocusY';

/** null = мета отсутствует; отсутствие ключа = ещё не грузили */
const metaCache = new Map<string, AvatarCropFileMeta | null>();
const metaInFlight = new Map<string, Promise<AvatarCropFileMeta | null>>();
const metaListeners = new Map<string, Set<() => void>>();

function notifyMetaListeners(fileId: string): void {
  metaListeners.get(fileId)?.forEach(fn => fn());
}

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

export function avatarFrameToCoverFocus(frame: AvatarCropFrame): CoverFocus {
  const next = normalizeAvatarCropFrame(frame);
  return {
    x: next.focusX * 100,
    y: next.focusY * 100,
    zoom: next.zoom,
  };
}

export function avatarCropImgStyle(frame: AvatarCropFrame): CSSProperties {
  return coverFocusImgStyle(avatarFrameToCoverFocus(frame));
}

export function peekAvatarCropMeta(fileId: string): AvatarCropFileMeta | null | undefined {
  if (!metaCache.has(fileId)) return undefined;
  return metaCache.get(fileId) ?? null;
}

export function rememberAvatarCropMeta(fileId: string, meta: AvatarCropFileMeta | null): AvatarCropFileMeta | null {
  metaCache.set(fileId, meta);
  notifyMetaListeners(fileId);
  return meta;
}

export function invalidateAvatarCropMeta(fileId: string): void {
  metaCache.delete(fileId);
  metaInFlight.delete(fileId);
  notifyMetaListeners(fileId);
}

/** Мета кадра: исходник и последние zoom/focus (если сохраняли). */
export async function loadAvatarCropMeta(cropFileId: string): Promise<AvatarCropFileMeta | null> {
  if (metaCache.has(cropFileId)) return metaCache.get(cropFileId) ?? null;
  if (metaInFlight.has(cropFileId)) return metaInFlight.get(cropFileId)!;

  const promise = getFileInfo(cropFileId)
    .then(info => {
      const parsed = parseAvatarCropContext(info?.description);
      metaCache.set(cropFileId, parsed);
      metaInFlight.delete(cropFileId);
      notifyMetaListeners(cropFileId);
      return parsed;
    })
    .catch(() => {
      metaInFlight.delete(cropFileId);
      return null;
    });

  metaInFlight.set(cropFileId, promise);
  return promise;
}

/** Подписка на мету кадра: undefined — ещё грузим, null — нет меты. */
export function useAvatarCropMeta(fileId: string | null | undefined): AvatarCropFileMeta | null | undefined {
  const [meta, setMeta] = useState<AvatarCropFileMeta | null | undefined>(() => (
    fileId ? peekAvatarCropMeta(fileId) : null
  ));

  useEffect(() => {
    if (!fileId) {
      setMeta(null);
      return;
    }

    const bump = () => setMeta(peekAvatarCropMeta(fileId));
    if (!metaListeners.has(fileId)) metaListeners.set(fileId, new Set());
    metaListeners.get(fileId)!.add(bump);

    const cached = peekAvatarCropMeta(fileId);
    if (cached !== undefined) {
      setMeta(cached);
    } else {
      setMeta(undefined);
      void loadAvatarCropMeta(fileId).then(next => {
        setMeta(next);
      });
    }

    return () => {
      metaListeners.get(fileId)?.delete(bump);
    };
  }, [fileId]);

  return meta;
}

/**
 * Что рисовать в круге аватара.
 * Есть мета → исходник + CSS-кадр (как шапка). Нет меты → сам fileId (старые кропы).
 */
export function useAvatarCropDisplay(fileId: string | null | undefined): {
  displayFileId: string | null;
  imgStyle: CSSProperties;
} {
  const meta = useAvatarCropMeta(fileId);
  if (!fileId) return { displayFileId: null, imgStyle: { objectFit: 'cover' } };
  if (meta) {
    return {
      displayFileId: meta.sourceFileId || fileId,
      imgStyle: avatarCropImgStyle(meta.frame),
    };
  }
  return { displayFileId: fileId, imgStyle: { objectFit: 'cover' } };
}

/** @deprecated используйте loadAvatarCropMeta */
export async function loadAvatarSourceFileId(cropFileId: string): Promise<string | null> {
  return (await loadAvatarCropMeta(cropFileId))?.sourceFileId ?? null;
}

/** Пишем исходник + кадр в описание файла-аватара (attach заменяет описание целиком). */
export async function saveAvatarCropMeta(
  avatarFileId: string,
  sourceFileId: string,
  frame: AvatarCropFrame,
): Promise<void> {
  const next = {
    sourceFileId,
    frame: normalizeAvatarCropFrame(frame),
  };
  await attachFileContext(avatarFileId, serializeAvatarCropContext(next));
  rememberAvatarCropMeta(avatarFileId, next);
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
  invalidateAvatarCropMeta(fileId);
}

/** GET /api/media/account/avatars/{accountId} — история аватаров (просмотр на странице пользователя) */
export async function getAvatarHistory(accountId: string): Promise<IAvatarInfo[]> {
  try {
    const r = await apiClient.get<IAvatarInfo[]>(`/api/media/account/avatars/getByAccountId/${accountId}`);
    return r.result ?? [];
  } catch { return []; }
}
