// ============================================================
// entities/event/api.ts
// API-сервис для работы с мероприятиями
// Базовый путь: /api/events  (из swagger)
// ============================================================

import { apiClient } from '@/shared/api/client';
import type { CommandResult, PagedList } from '@/shared/api/types';
import type {
  IEvent,
  IEventCategory,
  IEventType,
  IEventParameters,
  IEventsSearchParams,
  ICreateEventRequest,
  IEventParametersRequest,
} from './types';

// ---- Вспомогательная функция сборки query string ----

function buildQuery(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((item) => `${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`)
        : [`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`]
    )
    .join('&');
  return qs ? `?${qs}` : '';
}

// ---- Поиск мероприятий (POST /api/events/search) ----

export async function fetchEvents(
  params: IEventsSearchParams = {}
): Promise<PagedList<IEvent>> {
  const body = {
    pageIndex: 0,
    pageSize: 20,
    ...params,
  };

  const data = await apiClient.post<PagedList<IEvent>>('/api/events/search', body);
  return data.result;
}

// ---- Получить одно мероприятие (GET /api/events/get/{id}) ----

export async function fetchEventById(id: string): Promise<IEvent> {
  const data = await apiClient.get<IEvent>(`/api/events/get/${id}`);
  return data.result;
}

// ---- Создать мероприятие (POST /api/events/create) ----

export async function createEvent(
  payload: ICreateEventRequest
): Promise<string> {
  // API возвращает GuidNullableCommandResult (UUID нового события)
  const data = await apiClient.post<string>('/api/events/create', payload);
  return data.result;
}

// ---- Обновить мероприятие (PUT /api/events/update/{id}) ----

export async function updateEvent(
  id: string,
  payload: Partial<ICreateEventRequest>
): Promise<void> {
  await apiClient.put(`/api/events/update/${id}`, payload);
}

// ---- Удалить / отменить мероприятие (DELETE /api/events/delete/{id}) ----

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`/api/events/delete/${id}`);
}

// ---- Начать мероприятие (PUT /api/events/start/{id}) ----

export async function startEvent(id: string): Promise<void> {
  await apiClient.put(`/api/events/start/${id}`);
}

// ---- Завершить мероприятие (PUT /api/events/finish/{id}) ----

export async function finishEvent(id: string): Promise<void> {
  await apiClient.put(`/api/events/finish/${id}`);
}

// ---- Участие ----

// Методы участия перенесены в participationApi.ts

// ---- Параметры мероприятия (стоимость, ограничения) ----

export async function fetchEventParameters(
  eventId: string
): Promise<IEventParameters> {
  const data = await apiClient.get<IEventParameters>(
    `/api/events/parameters/get/${eventId}`
  );
  return data.result;
}

export async function updateEventParameters(
  eventId: string,
  payload: IEventParametersRequest
): Promise<void> {
  await apiClient.put(`/api/events/parameters/update/${eventId}`, payload);
}

// ---- Категории мероприятий ----

export async function fetchEventCategories(): Promise<IEventCategory[]> {
  const data = await apiClient.get<IEventCategory[]>('/api/events/eventCategories/getAll');
  return data.result;
}

// ---- Типы мероприятий ----

export async function fetchEventTypes(
  categoryId?: string
): Promise<IEventType[]> {
  const qs = buildQuery({ categoryId });
  const data = await apiClient.get<IEventType[]>(`/api/events/eventTypes/getAll${qs}`);
  return data.result;
}

// ---- Мок-данные для разработки (используйте пока нет реального API) ----

export const MOCK_EVENTS: IEvent[] = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    name: 'Jazz на набережной',
    description: 'Открытый концерт джазового квартета под открытым небом. Вход свободный.',
    address: 'Набережная реки Фонтанки, 20',
    latitude: 59.9311,
    longitude: 30.3609,
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
    active: true,
    eventParametersId: null,
    creationDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    parameters: { id: 'p1', cost: 0, private: false, maxPersonsCount: 500, ageLimit: null, allowedGender: null, allowUsersToInvite: true },
    eventType: { id: 't1', name: 'Концерт', namePath: 'music/concert', description: null, ico: null, eventCategoryId: 'c1', eventCategory: { id: 'c1', name: 'Музыка', namePath: 'music', ico: null, description: null } },
    participantsCount: 47,
    isParticipating: false,
    isOrganizer: false,
    anticipationRating: 4.2,
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Городской забег 5К',
    description: 'Ежегодный любительский забег по историческому центру города. Регистрация обязательна.',
    address: 'Дворцовая площадь',
    latitude: 59.9398,
    longitude: 30.3158,
    startTime: new Date(Date.now() + 172800000).toISOString(),
    endTime: new Date(Date.now() + 172800000 + 10800000).toISOString(),
    active: true,
    eventParametersId: 'p2',
    creationDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    parameters: { id: 'p2', cost: 500, private: false, maxPersonsCount: 200, ageLimit: 16, allowedGender: null, allowUsersToInvite: false },
    eventType: { id: 't2', name: 'Забег', namePath: 'sport/run', description: null, ico: null, eventCategoryId: 'c2', eventCategory: { id: 'c2', name: 'Спорт', namePath: 'sport', ico: null, description: null } },
    participantsCount: 143,
    isParticipating: true,
    isOrganizer: false,
    anticipationRating: 4.7,
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    name: 'Открытый микрофон в «Буке»',
    description: 'Вечер поэзии и живой музыки. Любой желающий может выступить — просто приходи!',
    address: 'Кафе «Бука», Рубинштейна 15',
    latitude: 59.9272,
    longitude: 30.3441,
    startTime: new Date(Date.now() + 3600000 * 5).toISOString(),
    endTime: null,
    active: true,
    eventParametersId: null,
    creationDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    parameters: { id: 'p3', cost: 0, private: false, maxPersonsCount: 60, ageLimit: 18, allowedGender: null, allowUsersToInvite: true },
    eventType: { id: 't3', name: 'Открытый микрофон', namePath: 'music/open-mic', description: null, ico: null, eventCategoryId: 'c1', eventCategory: { id: 'c1', name: 'Музыка', namePath: 'music', ico: null, description: null } },
    participantsCount: 22,
    isParticipating: false,
    isOrganizer: false,
    anticipationRating: 3.9,
  },
];

/** Мок-версия fetchEvents — используйте для разработки без бэкенда */
export async function fetchEventsMock(
  params: IEventsSearchParams = {}
): Promise<PagedList<IEvent>> {
  await new Promise((r) => setTimeout(r, 400)); // симулируем задержку

  let events = [...MOCK_EVENTS];

  if (params.name) {
    const q = params.name.toLowerCase();
    events = events.filter((e) => e.name.toLowerCase().includes(q));
  }

  const pageIndex = params.pageIndex ?? 0;
  const pageSize = params.pageSize ?? 20;

  return {
    pageIndex,
    pageSize,
    total: events.length,
    result: events.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
  };
}
