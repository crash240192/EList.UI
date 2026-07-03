export const DEFAULT_EVENT_CATEGORY_COLOR = '#6366f1';

export type EventTypeChipVariant = 'soft' | 'overlay';

export function getEventCategoryColor(
  source: { eventCategory?: { color?: string | null } | null } | null | undefined,
): string {
  return source?.eventCategory?.color ?? DEFAULT_EVENT_CATEGORY_COLOR;
}

export function getEventTypeChipSurface(
  color: string,
  variant: EventTypeChipVariant = 'soft',
): { background: string; border: string } {
  if (variant === 'overlay') {
    return {
      background: `${color}55`,
      border: `1px solid ${color}99`,
    };
  }
  return {
    background: `${color}20`,
    border: `0.5px solid ${color}55`,
  };
}
