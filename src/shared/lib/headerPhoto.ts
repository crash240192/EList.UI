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
  if (!description) return null;
  try {
    const data = JSON.parse(description) as Record<string, unknown>;
    const raw = data.headerBlurPercent ?? data.HeaderBlurPercent;
    if (raw == null || raw === '') return null;
    return clampHeaderBlurPercent(raw);
  } catch {
    return null;
  }
}

export function serializeHeaderBlurContext(percent: number): string {
  return JSON.stringify({ headerBlurPercent: clampHeaderBlurPercent(percent) });
}
