/** Допустимые значения возрастного ограничения мероприятия */
export const EVENT_AGE_LIMIT_OPTIONS = [0, 6, 12, 16, 18] as const;

export type EventAgeLimit = (typeof EVENT_AGE_LIMIT_OPTIONS)[number];

/** Возвращает доступные варианты с учётом лимита тарифа */
export function getAvailableAgeLimitOptions(
  maxAge: number | null,
  hasTariff: boolean,
): EventAgeLimit[] {
  if (!hasTariff) return [0];
  if (maxAge === 0) return [0];
  return EVENT_AGE_LIMIT_OPTIONS.filter(age => maxAge === null || age <= maxAge);
}

/** Нормализует значение к ближайшему допустимому варианту из списка */
export function normalizeAgeLimitValue(
  raw: number | null | undefined,
  maxAge: number | null,
  hasTariff: boolean,
): string {
  const options = getAvailableAgeLimitOptions(maxAge, hasTariff);
  if (raw == null || raw === 0) return String(options[0]);

  let nearest: EventAgeLimit = options[0];
  for (const age of EVENT_AGE_LIMIT_OPTIONS) {
    if (age <= raw) nearest = age;
  }

  if (options.includes(nearest)) return String(nearest);
  return String(options[options.length - 1]);
}

export function formatAgeLimitLabel(age: number): string {
  return `${age}+`;
}

/**
 * Текст плашки возраста для превью.
 * 0, null и пустое значение показываем как 0+.
 */
export function resolveAgeLimitBadge(
  age: number | string | null | undefined,
): string {
  if (age === '' || age == null) return '0+';
  const n = typeof age === 'number' ? age : parseInt(String(age), 10);
  if (Number.isNaN(n) || n < 0) return '0+';
  return formatAgeLimitLabel(n);
}

