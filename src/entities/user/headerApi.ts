import { apiClient } from '@/shared/api/client';
import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import { clampCoverFocusValue, clampCoverZoom, type CoverFocus } from '@/shared/lib/coverFocus';
import {
  parseHeaderPhotoContext,
  serializeHeaderPhotoContext,
} from '@/shared/lib/headerPhoto';

export interface AccountHeaderPayload {
  imageId: string | null;
  focus?: CoverFocus;
  /** true, когда на шкале больше 0%. */
  blur?: boolean;
}

export interface HeaderPhotoMeta {
  blurPercent: number;
  zoom: number;
}

const photoMetaCache = new Map<string, HeaderPhotoMeta>();

export function rememberHeaderPhotoMeta(fileId: string, meta: Partial<HeaderPhotoMeta>): HeaderPhotoMeta {
  const prev = photoMetaCache.get(fileId);
  const next: HeaderPhotoMeta = {
    blurPercent: meta.blurPercent ?? prev?.blurPercent ?? 0,
    zoom: clampCoverZoom(meta.zoom ?? prev?.zoom ?? 1),
  };
  photoMetaCache.set(fileId, next);
  return next;
}

export function peekHeaderPhotoMeta(fileId: string): HeaderPhotoMeta | undefined {
  return photoMetaCache.get(fileId);
}

export function rememberHeaderBlurPercent(fileId: string, percent: number): void {
  rememberHeaderPhotoMeta(fileId, { blurPercent: percent });
}

export function peekHeaderBlurPercent(fileId: string): number | undefined {
  return photoMetaCache.get(fileId)?.blurPercent;
}

export async function loadHeaderPhotoMeta(fileId: string): Promise<HeaderPhotoMeta> {
  const cached = photoMetaCache.get(fileId);
  if (cached) return cached;
  const info = await getFileInfo(fileId);
  const parsed = parseHeaderPhotoContext(info?.description);
  return rememberHeaderPhotoMeta(fileId, {
    blurPercent: parsed?.blurPercent ?? 0,
    zoom: parsed?.zoom ?? 1,
  });
}

export async function loadHeaderBlurPercent(fileId: string): Promise<number | null> {
  const meta = await loadHeaderPhotoMeta(fileId);
  return meta.blurPercent;
}

/**
 * Процент блюра и масштаб не входят в Account (там x/y и boolean blur).
 * Пишем оба в контекст исходного файла одним JSON: attach заменяет описание целиком.
 */
export async function saveHeaderPhotoMeta(fileId: string, meta: HeaderPhotoMeta): Promise<void> {
  const next = rememberHeaderPhotoMeta(fileId, meta);
  await attachFileContext(fileId, serializeHeaderPhotoContext(next));
}

export async function saveHeaderBlurPercent(fileId: string, percent: number): Promise<void> {
  const prev = photoMetaCache.get(fileId);
  await saveHeaderPhotoMeta(fileId, {
    blurPercent: percent,
    zoom: prev?.zoom ?? 1,
  });
}

/** PUT /api/accounts/header. imageId = null сбрасывает шапку. */
export async function setAccountHeader(payload: AccountHeaderPayload): Promise<void> {
  const body = payload.imageId == null
    ? { imageId: null }
    : {
        imageId: payload.imageId,
        focusX: clampCoverFocusValue(payload.focus?.x),
        focusY: clampCoverFocusValue(payload.focus?.y),
        blur: payload.blur === true,
      };
  await apiClient.put('/api/accounts/header', body);
}
