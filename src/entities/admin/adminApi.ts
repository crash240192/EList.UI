// entities/admin/adminApi.ts

import { apiClient } from '@/shared/api/client';
import { invalidateEventDictionariesCache } from '@/entities/event/dictionariesCache';

// ---- Категории мероприятий ----

export interface IEventCategory {
  id: string;
  name: string;
  localizationPath: string;
  ico: string | null;
  description: string | null;
  color: string | null;
  active?: boolean;
}

export interface IEventCategoryRequest {
  name: string;
  localizationPath: string;
  ico?: string | null;
  description?: string | null;
  color?: string | null;
}

function normalizeAdminCategory(raw: IEventCategory & Record<string, unknown>): IEventCategory {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    localizationPath: String(raw.localizationPath ?? raw.namePath ?? ''),
    ico: (raw.ico ?? null) as string | null,
    description: (raw.description ?? null) as string | null,
    color: (raw.color ?? null) as string | null,
    active: raw.active !== false,
  };
}

function normalizeAdminType(raw: IEventType & Record<string, unknown>): IEventType {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    localizationPath: String(raw.localizationPath ?? raw.namePath ?? ''),
    description: (raw.description ?? null) as string | null,
    ico: (raw.ico ?? null) as string | null,
    eventCategoryId: String(raw.eventCategoryId ?? ''),
    eventCategory: raw.eventCategory
      ? normalizeAdminCategory(raw.eventCategory as IEventCategory & Record<string, unknown>)
      : raw.eventCategory,
    active: raw.active !== false,
  };
}

export const categoriesApi = {
  getAll: async (): Promise<IEventCategory[]> => {
    const r = await apiClient.get<(IEventCategory & Record<string, unknown>)[]>(
      '/api/events/eventCategories/getAll',
    );
    return (r.result ?? []).map(normalizeAdminCategory);
  },
  create: async (payload: IEventCategoryRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/events/eventCategories/create', payload);
    invalidateEventDictionariesCache();
    return r.result;
  },
  update: async (id: string, payload: IEventCategoryRequest): Promise<void> => {
    await apiClient.put(`/api/events/eventCategories/update/${id}`, payload);
    invalidateEventDictionariesCache();
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/events/eventCategories/delete/${id}`);
    invalidateEventDictionariesCache();
  },
};

// ---- Типы мероприятий ----

export interface IEventType {
  id: string;
  name: string;
  localizationPath: string;
  description: string | null;
  ico: string | null;
  eventCategoryId: string;
  eventCategory?: IEventCategory | null;
  active?: boolean;
}

export interface IEventTypeRequest {
  name: string;
  localizationPath: string;
  description?: string | null;
  ico?: string | null;
  eventCategoryId: string;
}

export const typesApi = {
  getAll: async (): Promise<IEventType[]> => {
    const r = await apiClient.get<(IEventType & Record<string, unknown>)[]>(
      '/api/events/eventTypes/getAll',
    );
    return (r.result ?? []).map(normalizeAdminType);
  },
  create: async (payload: IEventTypeRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/events/eventTypes/create', payload);
    invalidateEventDictionariesCache();
    return r.result;
  },
  update: async (id: string, payload: IEventTypeRequest): Promise<void> => {
    await apiClient.put(`/api/events/eventTypes/update/${id}`, payload);
    invalidateEventDictionariesCache();
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/events/eventTypes/delete/${id}`);
    invalidateEventDictionariesCache();
  },
};

// ---- Тарифы ----

export interface ITariffValidator {
  id?: string;
  costLimit: number | null;
  personsLimit: number | null;
  allowPrivate: boolean;
  ageLimit: number | null;
  allowGenderSegregation: boolean;
  maxEventsCount: number | null;
  createDateMaxPeriod: number | null;
  allowMultidaysEvent: boolean;
}

export interface ITariffPeriod {
  days: number;
  hours: number;
  minutes: number;
  seconds?: number;
}

export interface ITariff {
  id: string;
  name: string;
  cost: number;
  period: ITariffPeriod;
  validatorId: string;
  /** Тариф для организаций (иначе — для пользователей) */
  forOrganization: boolean;
  tariffValidator?: ITariffValidator | null;
  /** Иногда приходит как periodDays вместо period */
  periodDays?: number;
}

export interface ITariffRequest {
  name: string;
  cost: number;
  periodDays: number;
  validatorId: string;
  forOrganization: boolean;
}

/** Парсит period из API: объект {days,hours,minutes}, TimeSpan-строка или periodDays. */
export function parseTariffPeriod(
  rawPeriod: unknown,
  periodDaysFallback?: unknown,
): ITariffPeriod {
  if (rawPeriod && typeof rawPeriod === 'object' && !Array.isArray(rawPeriod)) {
    const o = rawPeriod as Record<string, unknown>;
    return {
      days: Number(o.days ?? o.Days ?? 0) || 0,
      hours: Number(o.hours ?? o.Hours ?? 0) || 0,
      minutes: Number(o.minutes ?? o.Minutes ?? 0) || 0,
      seconds: Number(o.seconds ?? o.Seconds ?? 0) || 0,
    };
  }

  if (typeof rawPeriod === 'string' && rawPeriod.trim()) {
    // .NET TimeSpan: "HH:MM:SS", "D.HH:MM:SS", иногда с дробными секундами
    const s = rawPeriod.trim();
    const m = /^(-)?(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(s);
    if (m) {
      const days = Number(m[2] ?? 0);
      const hours = Number(m[3] ?? 0);
      const minutes = Number(m[4] ?? 0);
      const seconds = Number(m[5] ?? 0);
      return { days, hours, minutes, seconds };
    }
  }

  const daysOnly = Number(periodDaysFallback ?? 30);
  return {
    days: Number.isFinite(daysOnly) && daysOnly > 0 ? daysOnly : 30,
    hours: 0,
    minutes: 0,
  };
}

export function tariffPeriodTotalMinutes(period: ITariffPeriod | undefined | null): number {
  if (!period) return 30 * 24 * 60;
  return (period.days || 0) * 24 * 60
    + (period.hours || 0) * 60
    + (period.minutes || 0)
    + Math.ceil((period.seconds || 0) / 60);
}

/** Человекочитаемый период: «3 мин.», «2 ч.», «30 дн.» */
export function formatTariffPeriod(tariff: Pick<ITariff, 'period' | 'periodDays' | 'cost'>): string {
  if (tariff.cost <= 0) return 'базовый';
  const period = tariff.period
    ?? (tariff.periodDays != null
      ? { days: tariff.periodDays, hours: 0, minutes: 0 }
      : null);
  const totalMin = tariffPeriodTotalMinutes(period);
  if (totalMin <= 0) return '—';
  if (totalMin < 60) return `${totalMin} мин.`;
  if (totalMin < 24 * 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h} ч. ${m} мин.` : `${h} ч.`;
  }
  const days = Math.round(totalMin / (24 * 60));
  return `${days} дн.`;
}

function normalizeTariff(raw: ITariff & Record<string, unknown>): ITariff {
  const forOrganization = Boolean(
    raw.forOrganization ?? raw.ForOrganization ?? false,
  );
  const period = parseTariffPeriod(
    raw.period ?? raw.Period,
    raw.periodDays ?? raw.PeriodDays,
  );
  return {
    ...raw,
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    cost: Number(raw.cost ?? 0),
    validatorId: String(raw.validatorId ?? ''),
    forOrganization,
    period,
    periodDays: period.days > 0
      ? period.days
      : (Number(raw.periodDays ?? raw.PeriodDays) || undefined),
  };
}

async function fetchTariffsByAudience(forOrganization: boolean): Promise<ITariff[]> {
  const r = await apiClient.get<ITariff[]>(
    `/api/Wallets/tariffs?forOrganization=${forOrganization ? 'true' : 'false'}`,
  );
  return (r.result ?? []).map(t => normalizeTariff(t as ITariff & Record<string, unknown>));
}

export const tariffApi = {
  /**
   * GET /api/Wallets/tariffs?forOrganization=
   * По умолчанию — тарифы пользователей (forOrganization=false).
   */
  getAll: async (forOrganization = false): Promise<ITariff[]> => {
    return fetchTariffsByAudience(forOrganization);
  },
  /** Все тарифы для админки: пользователи + организации */
  getAllForAdmin: async (): Promise<ITariff[]> => {
    const [personal, organization] = await Promise.all([
      fetchTariffsByAudience(false),
      fetchTariffsByAudience(true),
    ]);
    const byId = new Map<string, ITariff>();
    for (const t of [...personal, ...organization]) byId.set(t.id, t);
    return [...byId.values()];
  },
  getById: async (id: string): Promise<ITariff | null> => {
    try {
      const r = await apiClient.get<ITariff>(`/api/Wallets/tariff/${id}`);
      return r.result ? normalizeTariff(r.result as ITariff & Record<string, unknown>) : null;
    } catch { return null; }
  },
  create: async (payload: ITariffRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/Wallets/tariff/create', payload);
    return r.result;
  },
  update: async (payload: ITariff | (ITariffRequest & { id: string; validatorId: string })): Promise<void> => {
    await apiClient.put('/api/Wallets/tariff/update', payload);
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/Wallets/tariff/${id}`);
  },
};

export const tariffValidatorApi = {
  getByTariff: async (tariffId: string): Promise<ITariffValidator | null> => {
    try {
      const r = await apiClient.get<ITariffValidator>(`/api/Wallets/tariffValidator/byTariffId/${tariffId}`);
      return r.result ?? null;
    } catch { return null; }
  },
  create: async (payload: ITariffValidator): Promise<string> => {
    const r = await apiClient.post<string>('/api/Wallets/tariffValidator/create', payload);
    return r.result;
  },
  update: async (payload: ITariffValidator): Promise<void> => {
    await apiClient.put('/api/Wallets/tariffValidator/update', payload);
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/Wallets/tariffValidator/${id}`);
  },
};


export interface IContactType {
  id: string;
  name: string;
  localizationPath: string;
  description: string | null;
  mask: string | null;
  allowNotifications: boolean;
}

export interface IContactTypeRequest {
  name: string;
  localizationPath: string;
  description?: string | null;
  mask?: string | null;
  allowNotifications: boolean;
}

export const contactTypesApi = {
  getAll: async (): Promise<IContactType[]> => {
    const r = await apiClient.get<IContactType[]>('/api/contacts/contactTypes/getAll');
    return r.result ?? [];
  },
  create: async (payload: IContactTypeRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/contacts/contactTypes/create', payload);
    return r.result;
  },
  update: async (id: string, payload: IContactTypeRequest): Promise<void> => {
    await apiClient.put(`/api/contacts/contactTypes/update/${id}`, payload);
  },
};
