// features/event-filters/ageFilter.ts
// Значения фильтра «Возраст до» / «только 18+»

import type { IEventsSearchParams } from '@/entities/event';
import { EVENT_AGE_LIMIT_OPTIONS } from '@/shared/lib/ageLimit';

export const AGE_FILTER_ADULT_ONLY = 'adult-only';

export interface AgeFilterOption {
  value: string;
  label: string;
  ageLimit?: number;
  adultOnly: boolean;
  /** Требует подтверждения 18+ (аноним) или возраста/ДР (авторизованный) */
  requiresAdult: boolean;
}

/** Варианты выпадающего списка возрастного фильтра */
export const AGE_FILTER_OPTIONS: AgeFilterOption[] = [
  ...EVENT_AGE_LIMIT_OPTIONS.map((age) => ({
    value: String(age),
    label: `${age}+`,
    ageLimit: age,
    adultOnly: false,
    requiresAdult: age >= 18,
  })),
  {
    value: AGE_FILTER_ADULT_ONLY,
    label: 'только 18+',
    ageLimit: 18,
    adultOnly: true,
    requiresAdult: true,
  },
];

export function ageFiltersActive(filters: Pick<IEventsSearchParams, 'ageLimit' | 'adultOnly'>): boolean {
  return filters.adultOnly === true || filters.ageLimit != null;
}

/** Текущее значение Select из стора фильтров */
export function ageFilterSelectValue(
  filters: Pick<IEventsSearchParams, 'ageLimit' | 'adultOnly'>,
): string {
  if (filters.adultOnly) return AGE_FILTER_ADULT_ONLY;
  if (filters.ageLimit == null) return '';
  return String(filters.ageLimit);
}

export function ageFilterChipLabel(
  filters: Pick<IEventsSearchParams, 'ageLimit' | 'adultOnly'>,
): string | null {
  if (filters.adultOnly) return 'только 18+';
  if (filters.ageLimit == null) return null;
  return `${filters.ageLimit}+`;
}

export function parseAgeFilterValue(value: string): {
  ageLimit: number | undefined;
  adultOnly: boolean;
  requiresAdult: boolean;
} {
  if (!value) {
    return { ageLimit: undefined, adultOnly: false, requiresAdult: false };
  }
  const opt = AGE_FILTER_OPTIONS.find((o) => o.value === value);
  if (!opt) {
    return { ageLimit: undefined, adultOnly: false, requiresAdult: false };
  }
  return {
    ageLimit: opt.ageLimit,
    adultOnly: opt.adultOnly,
    requiresAdult: opt.requiresAdult,
  };
}

/** Опции с учётом возраста авторизованного пользователя (<18 — без 18+) */
export function getAgeFilterSelectOptions(userAge: number | null): { value: string; label: string }[] {
  const under18 = userAge != null && userAge < 18;
  return AGE_FILTER_OPTIONS
    .filter((o) => !(under18 && o.requiresAdult))
    .map(({ value, label }) => ({ value, label }));
}
