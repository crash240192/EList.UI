// entities/admin/adminApi.ts

import { apiClient } from '@/shared/api/client';

// ---- Категории мероприятий ----

export interface IEventCategory {
  id: string;
  name: string;
  localizationPath: string;
  ico: string | null;
  description: string | null;
  color: string | null;
}

export interface IEventCategoryRequest {
  name: string;
  localizationPath: string;
  ico?: string | null;
  description?: string | null;
  color?: string | null;
}

export const categoriesApi = {
  getAll: async (): Promise<IEventCategory[]> => {
    const r = await apiClient.get<IEventCategory[]>('/api/events/eventCategories/getAll');
    return r.result ?? [];
  },
  create: async (payload: IEventCategoryRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/events/eventCategories/create', payload);
    return r.result;
  },
  update: async (id: string, payload: IEventCategoryRequest): Promise<void> => {
    await apiClient.put(`/api/events/eventCategories/update/${id}`, payload);
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/events/eventCategories/delete/${id}`);
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
    const r = await apiClient.get<IEventType[]>('/api/events/eventTypes/getAll');
    return r.result ?? [];
  },
  create: async (payload: IEventTypeRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/events/eventTypes/create', payload);
    return r.result;
  },
  update: async (id: string, payload: IEventTypeRequest): Promise<void> => {
    await apiClient.put(`/api/events/eventTypes/update/${id}`, payload);
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/events/eventTypes/delete/${id}`);
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
  tariffValidator?: ITariffValidator | null;
}

export interface ITariffRequest {
  name: string;
  cost: number;
  periodDays: number;
  validatorId: string;
}

export const tariffApi = {
  getAll: async (): Promise<ITariff[]> => {
    const r = await apiClient.get<ITariff[]>('/api/Wallets/tariff/all');
    return r.result ?? [];
  },
  getById: async (id: string): Promise<ITariff | null> => {
    try {
      const r = await apiClient.get<ITariff>(`/api/Wallets/tariff/${id}`);
      return r.result ?? null;
    } catch { return null; }
  },
  create: async (payload: ITariffRequest): Promise<string> => {
    const r = await apiClient.post<string>('/api/Wallets/tariff/create', payload);
    return r.result;
  },
  update: async (payload: ITariff): Promise<void> => {
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
