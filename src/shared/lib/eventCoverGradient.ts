// shared/lib/eventCoverGradient.ts
// Плейсхолдер обложки: несколько цветных пятен (цвета типов) с градиентным переходом.

const DEFAULT_COLORS = ['#6366f1', '#8b5cf6'];

export interface EventLikeForCover {
  id: string;
  eventTypes?: Array<{ eventCategory?: { color?: string | null } | null }> | null;
  eventType?: { eventCategory?: { color?: string | null } | null } | null;
}

/** Уникальные цвета категорий типов мероприятия */
export function getEventTypeColors(event: EventLikeForCover): string[] {
  const types = (event.eventTypes?.length ?? 0) > 0
    ? event.eventTypes!
    : event.eventType ? [event.eventType] : [];
  const colors = types
    .map(t => t.eventCategory?.color)
    .filter((c): c is string => typeof c === 'string' && c.length > 0);
  return colors.length ? [...new Set(colors)] : DEFAULT_COLORS;
}

function seededUnit(seed: string, index: number): number {
  let h = 2166136261;
  const s = `${seed}:${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function withAlpha(hex: string, alpha: number): string {
  if (typeof hex !== 'string' || !hex) return DEFAULT_COLORS[0];
  const raw = hex.replace('#', '');
  const full = raw.length === 3
    ? raw.split('').map(c => c + c).join('')
    : raw.length >= 6 ? raw.slice(0, 6) : null;
  if (!full) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

/**
 * CSS background: базовый линейный градиент + несколько radial-gradient «пятен»
 * в детерминированных позициях (seed), чтобы обложка не менялась при перерисовке.
 */
export function buildEventCoverBackground(seed: string, colors?: Array<string | null | undefined>): string {
  const palette = colors?.filter((c): c is string => typeof c === 'string' && c.length > 0) ?? [];
  const resolved = palette.length ? palette : DEFAULT_COLORS;
  const blobCount = Math.min(Math.max(resolved.length + 1, 3), 5);

  const blobs = Array.from({ length: blobCount }, (_, i) => {
    const color = resolved[i % resolved.length];
    const x = 12 + seededUnit(seed, i * 3) * 76;
    const y = 10 + seededUnit(seed, i * 3 + 1) * 80;
    const size = 42 + seededUnit(seed, i * 3 + 2) * 38;
    const alpha = 0.7 + seededUnit(seed, i * 3 + 4) * 0.25;
    return `radial-gradient(ellipse ${size.toFixed(0)}% ${(size * 1.15).toFixed(0)}% at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${withAlpha(color, alpha)} 0%, transparent 72%)`;
  });

  const c0 = resolved[0];
  const c1 = resolved[resolved.length > 1 ? 1 : 0];
  const base = `linear-gradient(145deg, ${c0} 0%, ${c1} 100%)`;
  return [...blobs, base].join(', ');
}

export function getEventCoverBackground(event: EventLikeForCover): string {
  return buildEventCoverBackground(event.id, getEventTypeColors(event));
}
