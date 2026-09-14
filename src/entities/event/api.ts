// ============================================================
// entities/event/api.ts
// API-сервис для работы с мероприятиями
// Базовый путь: /api/events  (из swagger)
// ============================================================

import { parseCoverFocusFromRecord } from '@/shared/lib/coverFocus';
import { loadCoverFocusFromFile } from './coverFocusApi';
import { apiClient } from '@/shared/api/client';
import type { CommandResult, PagedList } from '@/shared/api/types';
import type {
  IEvent,
  IEventParameters,
  IEventsSearchParams,
  IEventSearchShortItem,
  ICreateEventRequest,
  IEventParametersRequest,
} from './types';

// ---- Поиск мероприятий (POST /api/events/search) ----

export async function fetchEvents(
  params: IEventsSearchParams = {}
): Promise<PagedList<IEvent>> {
  const body = {
    pageIndex: 0,
    pageSize: 20,
    active: true,  // по умолчанию ищем только активные мероприятия
    ...params,
    adultOnly: params.adultOnly === true,
  };

  const data = await apiClient.post<PagedList<IEvent>>('/api/events/search', body);
  const paged = data.result;
  // Бэкенд возвращает Types (с заглавной) — нормализуем в eventTypes
  if (paged?.result) {
    paged.result = paged.result.map((ev: any) => ({
      ...ev,
      eventTypes: ev.Types ?? ev.types ?? ev.eventTypes ?? [],
      eventType:  ev.eventType ?? (ev.Types ?? ev.types ?? ev.eventTypes)?.[0] ?? null,
      coverImageId: ev.coverImageId ?? ev.CoverImageId ?? null,
      coverUrl: ev.coverUrl ?? ev.CoverUrl ?? null,
      coverFocusX: parseCoverFocusFromRecord(ev)?.x ?? null,
      coverFocusY: parseCoverFocusFromRecord(ev)?.y ?? null,
    }));
  }
  return paged;
}

/** Размер выборки для карты (search/short); совпадает с телом запроса */
export const EVENTS_MAP_SHORT_PAGE_SIZE = 500;

/** Поиск для карты: компактные точки (POST /api/events/search/short) */
export async function fetchEventsSearchShort(
  params: IEventsSearchParams = {}
): Promise<PagedList<IEventSearchShortItem>> {
  const body = {
    ...params,
    active: true,
    pageIndex: 0,
    pageSize: EVENTS_MAP_SHORT_PAGE_SIZE,
    adultOnly: params.adultOnly === true,
  };
  const data = await apiClient.post<PagedList<IEventSearchShortItem>>('/api/events/search/short', body);
  const paged = data.result;
  if (paged?.result) {
    paged.result = paged.result.map((row: IEventSearchShortItem) => {
      const r = row as IEventSearchShortItem & { StartTime?: string };
      const start = r.startTime ?? r.StartTime;
      return {
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        colors: Array.isArray(r.colors) ? r.colors : [],
        ...(start != null && start !== '' ? { startTime: String(start) } : {}),
      };
    });
  }
  return paged;
}

// ---- Получить одно мероприятие (GET /api/events/get/{id}) ----

export async function fetchEventById(id: string): Promise<IEvent> {
  const data = await apiClient.get<IEvent>(`/api/events/get/${id}`);
  const ev: any = data.result;
  const cancelSourceRaw = ev.cancelSource ?? ev.CancelSource ?? null;
  const coverImageId = ev.coverImageId ?? ev.CoverImageId ?? null;
  let focus = parseCoverFocusFromRecord(ev);
  if (!focus && coverImageId) {
    try {
      focus = await loadCoverFocusFromFile(String(coverImageId));
    } catch {
      focus = null;
    }
  }
  return {
    ...ev,
    eventTypes: ev.Types ?? ev.types ?? ev.eventTypes ?? [],
    eventType:  ev.eventType ?? (ev.Types ?? ev.types ?? ev.eventTypes)?.[0] ?? null,
    coverImageId,
    coverUrl: ev.coverUrl ?? ev.CoverUrl ?? null,
    coverFocusX: focus?.x ?? null,
    coverFocusY: focus?.y ?? null,
    cancelledAt: ev.cancelledAt ?? ev.CancelledAt ?? null,
    cancelledByAccountId: ev.cancelledByAccountId ?? ev.CancelledByAccountId ?? null,
    cancelSource: typeof cancelSourceRaw === 'string' && cancelSourceRaw
      ? String(cancelSourceRaw).toLowerCase()
      : null,
    cancelReportId: ev.cancelReportId ?? ev.CancelReportId ?? null,
  };
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

// ---- Категории / типы мероприятий (кеш + фильтр active) ----

export {
  fetchEventCategories,
  fetchEventTypes,
  invalidateEventDictionariesCache,
} from './dictionariesCache';
export type { FetchDictionariesOptions } from './dictionariesCache';

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
    parameters: { id: 'p1', cost: 0, private: false, maxPersonsCount: 500, ageLimit: null, allowedGender: null, allowUsersToInvite: true, ticketsEnabled: false },
    eventType: { id: 't1', name: 'Концерт', namePath: 'music/concert', description: null, ico: null, eventCategoryId: 'c1', eventCategory: { id: 'c1', name: 'Музыка', namePath: 'music', ico: null, description: null, color: null } },
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
    parameters: { id: 'p2', cost: 500, private: false, maxPersonsCount: 200, ageLimit: 16, allowedGender: null, allowUsersToInvite: false, ticketsEnabled: true },
    eventType: { id: 't2', name: 'Забег', namePath: 'sport/run', description: null, ico: null, eventCategoryId: 'c2', eventCategory: { id: 'c2', name: 'Спорт', namePath: 'sport', ico: null, description: null, color: null } },
    participantsCount: 143,
    isParticipating: true,
    isOrganizer: false,
    anticipationRating: 4.7,
  },
  {
    id: '11111111-0000-0000-0000-000000000004',
    name: 'Лекция в коворкинге',
    description: 'Оплата на месте у организатора; онлайн-билеты выключены.',
    address: 'Невский пр., 100',
    latitude: 59.9311,
    longitude: 30.3609,
    startTime: new Date(Date.now() + 259200000).toISOString(),
    endTime: new Date(Date.now() + 259200000 + 5400000).toISOString(),
    active: true,
    eventParametersId: 'p4',
    creationDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    parameters: { id: 'p4', cost: 800, private: false, maxPersonsCount: 40, ageLimit: null, allowedGender: null, allowUsersToInvite: true, ticketsEnabled: false },
    eventType: { id: 't1', name: 'Концерт', namePath: 'music/concert', description: null, ico: null, eventCategoryId: 'c1', eventCategory: { id: 'c1', name: 'Музыка', namePath: 'music', ico: null, description: null, color: null } },
    participantsCount: 12,
    isParticipating: false,
    isOrganizer: false,
    anticipationRating: 3.9,
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
    parameters: { id: 'p3', cost: 0, private: false, maxPersonsCount: 60, ageLimit: 18, allowedGender: null, allowUsersToInvite: true, ticketsEnabled: false },
    eventType: { id: 't3', name: 'Открытый микрофон', namePath: 'music/open-mic', description: null, ico: null, eventCategoryId: 'c1', eventCategory: { id: 'c1', name: 'Музыка', namePath: 'music', ico: null, description: null, color: null } },
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

function mockMarkerColors(ev: IEvent): string[] {
  const types = ev.eventTypes ?? (ev.eventType ? [ev.eventType] : []);
  const colors = types
    .map(t => t.eventCategory?.color)
    .filter((c): c is string => !!c);
  return colors.length ? [...new Set(colors)] : ['#6366f1'];
}

/** Мок search/short для VITE_USE_MOCK */
export async function fetchEventsSearchShortMock(
  params: IEventsSearchParams = {}
): Promise<PagedList<IEventSearchShortItem>> {
  await new Promise((r) => setTimeout(r, 280));
  const full = await fetchEventsMock({ ...params, pageIndex: 0, pageSize: EVENTS_MAP_SHORT_PAGE_SIZE });
  const items: IEventSearchShortItem[] = (full.result ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    latitude: e.latitude,
    longitude: e.longitude,
    colors: mockMarkerColors(e),
  }));
  return {
    pageIndex: 0,
    pageSize: EVENTS_MAP_SHORT_PAGE_SIZE,
    total: full.total,
    result: items,
  };
}
