// ============================================================
// entities/event/types.ts
// Бизнес-сущность "Мероприятие" — типы из EList Swagger API
// ============================================================

import type { Gender, PagedList } from '@/shared/api/types';

// ---------- Категория и тип мероприятия ----------

export interface IEventCategory {
  id: string;           // UUID
  name: string;
  namePath: string;     // slug-путь (напр. "music")
  ico: string | null;   // base64 иконка
  description: string | null;
  color: string | null; // цвет категории, напр. "#6366f1"
}

export interface IEventType {
  id: string;           // UUID
  name: string;
  namePath: string;     // slug-путь (напр. "music/concert")
  description: string | null;
  ico: string | null;   // base64 иконка
  eventCategoryId: string;
  eventCategory: IEventCategory | null;
}

// ---------- Параметры мероприятия ----------

export interface IEventParameters {
  id: string;
  cost: number;                 // 0 = бесплатно
  private: boolean;
  maxPersonsCount: number | null;
  ageLimit: number | null;
  allowedGender: Gender | null;
  allowUsersToInvite: boolean;
}

// ---------- Основная сущность Event ----------

export interface IEvent {
  id: string;           // UUID
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  startTime: string;    // ISO 8601
  endTime: string | null;
  active: boolean;
  eventParametersId: string | null;
  creationDate: string;
  updateDate: string;

  // Поля, которые фронтенд добавляет / обогащает:
  parameters?: IEventParameters | null;
  eventType?: IEventType | null;
  /** Список типов мероприятия (приходит из API в поле Types) */
  eventTypes?: IEventType[];
  /** URL обложки (из MediaAlbum) */
  coverUrl?:      string | null;
  coverImageId?:  string | null;
  /** Кол-во участников */
  participantsCount?: number;
  /** Текущий пользователь участвует */
  isParticipating?: boolean;
  /** Текущий пользователь — организатор */
  isOrganizer?: boolean;
  /** Рейтинг ожидания (1–5) */
  anticipationRating?: number | null;
}

// ---------- Параметры поиска ----------

export interface IEventsSearchParams {
  startTime?: string;
  endTime?: string;
  latitude?: number;
  longitude?: number;
  locationRange?: number;
  types?: string[];         // массив UUID типов
  categories?: string[];    // массив UUID категорий
  name?: string;
  organizatorId?: string;
  participantId?: string;
  price?: number;
  allowedGender?: Gender;
  pageIndex?: number;
  pageSize?: number;
}

/** Компактная точка для карты (ответ POST /api/events/search/short) */
export interface IEventSearchShortItem {
  id:        string;
  name:      string;
  latitude:  number;
  longitude: number;
  colors:    string[];
}

// ---------- Запросы на создание/обновление ----------

export interface ICreateEventRequest {
  name: string;
  description?: string;
  address?: string;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime?: string;
  active?: boolean;
}

export interface IEventParametersRequest {
  cost?: number;
  private?: boolean;
  maxPersonsCount?: number;
  ageLimit?: number;
  allowedGender?: Gender;
  allowUsersToInvite?: boolean;
}

// ---------- Пагинированный ответ ----------

export type IEventPagedList = PagedList<IEvent>;

// ---------- Вспомогательные типы UI ----------

export type EventViewMode = 'map' | 'list';

/** Статус участия текущего пользователя */
export type ParticipationStatus = 'none' | 'participant' | 'organizer' | 'admin';
