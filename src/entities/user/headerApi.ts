import { apiClient } from '@/shared/api/client';
import { attachFileContext, getFileInfo } from '@/shared/api/fileStorageClient';
import { clampCoverFocusValue, type CoverFocus } from '@/shared/lib/coverFocus';
import {
  parseHeaderBlurPercent,
  serializeHeaderBlurContext,
} from '@/shared/lib/headerPhoto';

export interface AccountHeaderPayload {
  imageId: string | null;
  focus?: CoverFocus;
  /** true, когда на шкале больше 0%. */
  blur?: boolean;
}

const blurPercentCache = new Map<string, number>();

export function rememberHeaderBlurPercent(fileId: string, percent: number): void {
  blurPercentCache.set(fileId, percent);
}

export function peekHeaderBlurPercent(fileId: string): number | undefined {
  return blurPercentCache.get(fileId);
}

export async function loadHeaderBlurPercent(fileId: string): Promise<number | null> {
  const cached = blurPercentCache.get(fileId);
  if (cached != null) return cached;
  const info = await getFileInfo(fileId);
  const percent = parseHeaderBlurPercent(info?.description);
  if (percent != null) blurPercentCache.set(fileId, percent);
  return percent;
}

/**
 * Процент блюра не входит в Account (там только boolean blur).
 * Пишем его в контекст исходного файла, чтобы при повторном открытии
 * вернуть ту же шкалу и тот же кадр.
 */
export async function saveHeaderBlurPercent(fileId: string, percent: number): Promise<void> {
  rememberHeaderBlurPercent(fileId, percent);
  await attachFileContext(fileId, serializeHeaderBlurContext(percent));
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
