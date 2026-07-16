export const DEFAULT_EVENT_CATEGORY_COLOR = '#6366f1';

export type EventTypeChipVariant = 'soft' | 'overlay';

export function getEventCategoryColor(
  source: { eventCategory?: { color?: string | null } | null } | null | undefined,
): string {
  return source?.eventCategory?.color ?? DEFAULT_EVENT_CATEGORY_COLOR;
}

/** Инверсия RGB-цвета категории (для фона чипов на hero). */
export function invertHexColor(hex: string): string {
  const raw = hex.replace('#', '').trim();
  let full = raw;
  if (raw.length === 3) {
    full = raw.split('').map(ch => ch + ch).join('');
  }
  if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) {
    return hex.startsWith('#') ? hex : `#${hex}`;
  }
  const inverted = (0xffffff ^ parseInt(full, 16)) >>> 0;
  return `#${inverted.toString(16).padStart(6, '0')}`;
}

export function getEventTypeChipSurface(
  color: string,
  variant: EventTypeChipVariant = 'soft',
  options?: { invert?: boolean },
): { background: string; border: string } {
  const fill = options?.invert ? invertHexColor(color) : color;
  if (variant === 'overlay') {
    return {
      background: `${fill}55`,
      border: `1px solid ${fill}99`,
    };
  }
  return {
    background: `${fill}20`,
    border: `0.5px solid ${fill}55`,
  };
}
