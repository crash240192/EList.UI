import { clampCoverZoom } from '@/shared/lib/coverFocus';

/** Блюр шапки профиля: шкала 0…60%. В аккаунте API хранит только boolean. */

export const HEADER_BLUR_MAX_PERCENT = 60;
/** 60% шкалы — заметное размытие, слабее запасного блюра аватара (20px). */
export const HEADER_BLUR_MAX_PX = 16;
/** Одинаковый масштаб кадра в превью и в шапке, чтобы блюр не менял кадрирование. */
export const HEADER_BLUR_FRAME_SCALE = 1.08;
/** Если сервер включил блюр, а процент в файле ещё не прочитан. */
export const HEADER_BLUR_FALLBACK_PERCENT = 40;

export function clampHeaderBlurPercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(HEADER_BLUR_MAX_PERCENT, Math.max(0, Math.round(n)));
}

export function headerBlurFilter(percent: number): string | undefined {
  const p = clampHeaderBlurPercent(percent);
  if (p <= 0) return undefined;
  const px = (p / HEADER_BLUR_MAX_PERCENT) * HEADER_BLUR_MAX_PX;
  const rounded = Math.round(px * 10) / 10;
  return `blur(${rounded}px)`;
}

export function parseHeaderBlurPercent(description: string | null | undefined): number | null {
  const meta = parseHeaderPhotoContext(description);
  return meta?.blurPercent ?? null;
}

export interface HeaderPhotoFileMeta {
  blurPercent: number | null;
  zoom: number | null;
}

/** Контекст файла шапки: процент блюра и масштаб. Один JSON, attach заменяет описание целиком. */
export function parseHeaderPhotoContext(description: string | null | undefined): HeaderPhotoFileMeta | null {
  if (!description) return null;
  try {
    const data = JSON.parse(description) as Record<string, unknown>;
    const rawBlur = data.headerBlurPercent ?? data.HeaderBlurPercent;
    const rawZoom = data.headerZoom ?? data.HeaderZoom;
    const blurPercent = rawBlur == null || rawBlur === '' ? null : clampHeaderBlurPercent(rawBlur);
    const zoom = rawZoom == null || rawZoom === '' ? null : clampCoverZoom(rawZoom);
    if (blurPercent == null && zoom == null) return null;
    return { blurPercent, zoom };
  } catch {
    return null;
  }
}

export function serializeHeaderPhotoContext(meta: { blurPercent: number; zoom: number }): string {
  return JSON.stringify({
    headerBlurPercent: clampHeaderBlurPercent(meta.blurPercent),
    headerZoom: clampCoverZoom(meta.zoom),
  });
}

export function serializeHeaderBlurContext(percent: number, zoom = 1): string {
  return serializeHeaderPhotoContext({ blurPercent: percent, zoom });
}
