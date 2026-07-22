/** Стандартные ступени возрастного ценза (тариф в админке, фильтры поиска) */
export const EVENT_AGE_LIMIT_OPTIONS = [0, 6, 12, 16, 18] as const;

export type EventAgeLimit = (typeof EVENT_AGE_LIMIT_OPTIONS)[number];

/**
 * Максимальный возрастной ценз события по лимиту тарифа.
 * `null` = без ограничений (можно указать любой возраст ≥ 0).
 *
 * Значение в валидаторе тарифа — верхняя граница включительно:
 * - нет тарифа → только 0
 * - в тарифе null (пусто) → любой возраст
 * - в тарифе N (0 / 6 / 12 / 16 / 18) → от 0 до N включительно
 */
export function getMaxEventAgeForTariff(
  tariffAgeLimit: number | null,
  hasTariff: boolean,
): number | null {
  if (!hasTariff) return 0;
  return tariffAgeLimit;
}

/** Допустимо ли указанное возрастное ограничение события при данном тарифе */
export function isEventAgeAllowed(
  age: number,
  tariffAgeLimit: number | null,
  hasTariff: boolean,
): boolean {
  if (!Number.isFinite(age) || age < 0 || !Number.isInteger(age)) return false;
  const max = getMaxEventAgeForTariff(tariffAgeLimit, hasTariff);
  if (max == null) return true;
  return age <= max;
}

/** Подпись лимита тарифа для кошелька / подсказок */
export function formatTariffAgeCapability(tariffAgeLimit: number | null): string {
  if (tariffAgeLimit == null) return 'Без ограничений';
  return formatTariffAgeLimitLabel(tariffAgeLimit);
}

/** Подпись опции в админке валидатора: «до 18+» */
export function formatTariffAgeLimitLabel(age: number): string {
  return `до ${age}+`;
}

/** Варианты для селекта тарифа в админке (пресеты) */
export function getAvailableAgeLimitOptions(
  maxAge: number | null,
  hasTariff: boolean,
): EventAgeLimit[] {
  if (!hasTariff) return [0];
  if (maxAge === 0) return [0];
  return EVENT_AGE_LIMIT_OPTIONS.filter(age => maxAge === null || age <= maxAge);
}

/** Нормализует значение к ближайшему пресету (админка тарифов) */
export function normalizeAgeLimitValue(
  raw: number | null | undefined,
  maxAge: number | null,
  hasTariff: boolean,
): string {
  const options = getAvailableAgeLimitOptions(maxAge, hasTariff);
  if (raw == null) return String(options[0]);

  if ((options as readonly number[]).includes(raw)) return String(raw);

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
