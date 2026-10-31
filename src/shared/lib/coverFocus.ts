/** Фокус обложки: точка 0…100 и масштаб поверх object-fit: cover. */

export interface CoverFocus {
  x: number;
  y: number;
  /**
   * 1 — кадр как `object-fit: cover`.
   * Больше 1 — увеличение: по ширине появляется запас, кадр двигается и влево-вправо.
   */
  zoom?: number;
}

export const COVER_ZOOM_MIN = 1;
export const COVER_ZOOM_MAX = 3;

export const DEFAULT_COVER_FOCUS: CoverFocus = { x: 50, y: 50, zoom: 1 };

const CONTEXT_PREFIX = 'elist-cover-focus:';

export function clampCoverFocusValue(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

export function clampCoverZoom(n: unknown, fallback = COVER_ZOOM_MIN): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  const clamped = Math.min(COVER_ZOOM_MAX, Math.max(COVER_ZOOM_MIN, v));
  return Math.round(clamped * 100) / 100;
}

export function coverZoomOf(focus?: { zoom?: number } | null): number {
  return clampCoverZoom(focus?.zoom ?? COVER_ZOOM_MIN);
}

export function normalizeCoverFocus(raw?: Partial<CoverFocus> | null): CoverFocus {
  return {
    x: clampCoverFocusValue(raw?.x),
    y: clampCoverFocusValue(raw?.y),
    zoom: clampCoverZoom(raw?.zoom ?? COVER_ZOOM_MIN),
  };
}

/** zoom есть в записи, только если сервер или файл его явно прислали. */
export function readExplicitCoverZoom(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!('coverZoom' in o) && !('CoverZoom' in o)) return null;
  const z = o.coverZoom ?? o.CoverZoom;
  if (z == null || z === '') return null;
  return clampCoverZoom(z);
}

export function coverFocusFromEvent(raw: {
  coverFocusX?: number | null;
  coverFocusY?: number | null;
  coverZoom?: number | null;
} | null | undefined): CoverFocus | null {
  if (!raw) return null;
  const zoom = readExplicitCoverZoom(raw);
  if (raw.coverFocusX == null && raw.coverFocusY == null && zoom == null) return null;
  return normalizeCoverFocus({
    x: raw.coverFocusX ?? 50,
    y: raw.coverFocusY ?? 50,
    zoom: zoom ?? COVER_ZOOM_MIN,
  });
}

export function coverObjectPosition(focus?: CoverFocus | null): string {
  const f = normalizeCoverFocus(focus);
  return `${f.x}% ${f.y}%`;
}

export function formatCoverZoom(zoom: number): string {
  const text = clampCoverZoom(zoom).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${text}×`;
}

/**
 * Кадр cover + масштаб.
 * `transform: scale` вокруг точки фокуса совпадает с увеличением уже покрытого кадра,
 * поэтому при zoom > 1 появляется сдвиг по оси, которой на cover не хватало запаса.
 * frameScale — запас под блюр (шапка). При zoom = 1 он по-прежнему от центра.
 */
export function coverFocusImgStyle(
  focus?: CoverFocus | null,
  options?: { frameScale?: number },
): {
  objectFit: 'cover';
  objectPosition: string;
  transform?: string;
  transformOrigin?: string;
} {
  const f = normalizeCoverFocus(focus);
  const zoom = coverZoomOf(f);
  const frameScale = options?.frameScale && options.frameScale > 0 ? options.frameScale : 1;
  const style = {
    objectFit: 'cover' as const,
    objectPosition: coverObjectPosition(f),
  };
  if (zoom === COVER_ZOOM_MIN && frameScale === 1) return style;
  if (zoom === COVER_ZOOM_MIN) {
    return { ...style, transform: `scale(${frameScale})` };
  }
  const scale = Math.round(zoom * frameScale * 1000) / 1000;
  return {
    ...style,
    transform: `scale(${scale})`,
    transformOrigin: `${f.x}% ${f.y}%`,
  };
}

/**
 * Сдвиг пальцем 1:1. По оси без запаса (широкая шапка при zoom = 1) фокус не меняется.
 * natW/natH = 0, пока картинка не загрузилась: запас оцениваем по рамке.
 */
export function panCoverFocus(
  start: CoverFocus,
  dx: number,
  dy: number,
  frameW: number,
  frameH: number,
  natW = 0,
  natH = 0,
  frameScale = 1,
): CoverFocus {
  const zoom = coverZoomOf(start) * (frameScale > 0 ? frameScale : 1);
  let overflowX = 0;
  let overflowY = 0;
  if (frameW > 0 && frameH > 0 && natW > 0 && natH > 0) {
    const cover = Math.max(frameW / natW, frameH / natH);
    overflowX = natW * cover * zoom - frameW;
    overflowY = natH * cover * zoom - frameH;
  } else if (frameW > 0 && frameH > 0) {
    overflowX = frameW * Math.max(0, zoom - 1);
    overflowY = frameH * Math.max(zoom, 1);
  }
  const x = overflowX > 0.5
    ? clampCoverFocusValue(start.x - (dx / overflowX) * 100)
    : start.x;
  const y = overflowY > 0.5
    ? clampCoverFocusValue(start.y - (dy / overflowY) * 100)
    : start.y;
  return { x, y, zoom: coverZoomOf(start) };
}

export function parseCoverFocusFromRecord(raw: unknown): CoverFocus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const x = o.coverFocusX ?? o.CoverFocusX ?? o.focusX ?? o.FocusX ?? o.x;
  const y = o.coverFocusY ?? o.CoverFocusY ?? o.focusY ?? o.FocusY ?? o.y;
  const zoom = readExplicitCoverZoom(o);
  if (x == null && y == null && zoom == null) return null;
  return normalizeCoverFocus({
    x: x == null ? 50 : Number(x),
    y: y == null ? 50 : Number(y),
    zoom: zoom ?? COVER_ZOOM_MIN,
  });
}

export function parseCoverFocusFromContext(context: string | null | undefined): CoverFocus | null {
  if (!context) return null;
  let text = context.trim();
  if (text.startsWith(CONTEXT_PREFIX)) text = text.slice(CONTEXT_PREFIX.length);
  try {
    return parseCoverFocusFromRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

export function serializeCoverFocusContext(focus: CoverFocus): string {
  const f = normalizeCoverFocus(focus);
  // Filestorage attachContext requires a pure JSON object (JObject.Parse).
  return JSON.stringify({ coverFocusX: f.x, coverFocusY: f.y, coverZoom: f.zoom });
}

export function coverFocusEventPayload(focus: CoverFocus): Record<string, number> {
  const f = normalizeCoverFocus(focus);
  return {
    coverFocusX: f.x,
    coverFocusY: f.y,
    CoverFocusX: f.x,
    CoverFocusY: f.y,
  };
}
