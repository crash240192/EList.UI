/** Фокус обложки: точка 0…100, которую `object-position` держит в кадре. */

export interface CoverFocus {
  x: number;
  y: number;
}

export const DEFAULT_COVER_FOCUS: CoverFocus = { x: 50, y: 50 };

const CONTEXT_PREFIX = 'elist-cover-focus:';

export function clampCoverFocusValue(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

export function normalizeCoverFocus(raw?: Partial<CoverFocus> | null): CoverFocus {
  return {
    x: clampCoverFocusValue(raw?.x),
    y: clampCoverFocusValue(raw?.y),
  };
}

export function coverFocusFromEvent(raw: {
  coverFocusX?: number | null;
  coverFocusY?: number | null;
} | null | undefined): CoverFocus | null {
  if (!raw) return null;
  if (raw.coverFocusX == null && raw.coverFocusY == null) return null;
  return normalizeCoverFocus({ x: raw.coverFocusX ?? 50, y: raw.coverFocusY ?? 50 });
}

export function coverObjectPosition(focus?: CoverFocus | null): string {
  const f = normalizeCoverFocus(focus);
  return `${f.x}% ${f.y}%`;
}

export function coverFocusImgStyle(focus?: CoverFocus | null): {
  objectFit: 'cover';
  objectPosition: string;
} {
  return {
    objectFit: 'cover',
    objectPosition: coverObjectPosition(focus),
  };
}

export function parseCoverFocusFromRecord(raw: unknown): CoverFocus | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const x = o.coverFocusX ?? o.CoverFocusX ?? o.focusX ?? o.FocusX ?? o.x;
  const y = o.coverFocusY ?? o.CoverFocusY ?? o.focusY ?? o.FocusY ?? o.y;
  if (x == null && y == null) return null;
  return normalizeCoverFocus({ x: Number(x), y: Number(y) });
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
  return JSON.stringify({ coverFocusX: f.x, coverFocusY: f.y });
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
