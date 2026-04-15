// entities/admin/adminApi.ts

import { apiClient } from '@/shared/api/client';

// ---- Категории мероприятий ----

export interface IEventCategory {
  id: string;
  name: string;
  localizationPath: string;
  ico: string | null;
  description: string | null;
}

export interface IEventCategoryRequest {
  name: string;
  localizationPath: string;
  ico?: string | null;
  description?: string | null;
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

// ---- Типы контактов ----

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
