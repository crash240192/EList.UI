/** Сортировка списка мероприятий (orderBy для /api/events/search). */

export type EventListSortId =
  | 'startAsc'
  | 'startDesc'
  | 'ageAsc'
  | 'ageDesc'
  | 'costAsc'
  | 'costDesc'
  | 'nameAsc'
  | 'createdDesc';

export interface EventListSortOption {
  id: EventListSortId;
  label: string;
  hint?: string;
  /** Строка для API EventsSearchRequest.OrderBy */
  orderBy: string;
}

export const EVENT_LIST_SORT_OPTIONS: EventListSortOption[] = [
  {
    id: 'startAsc',
    label: 'Сначала ближайшие',
    hint: 'По дате начала',
    orderBy: 'StartTime',
  },
  {
    id: 'startDesc',
    label: 'Сначала поздние',
    hint: 'По дате начала',
    orderBy: 'StartTime DESC',
  },
  {
    id: 'ageAsc',
    label: 'Возраст: 0+ → 18+',
    orderBy: 'AgeLimit',
  },
  {
    id: 'ageDesc',
    label: 'Возраст: 18+ → 0+',
    orderBy: 'AgeLimit DESC',
  },
  {
    id: 'costAsc',
    label: 'Сначала дешевле',
    orderBy: 'Cost',
  },
  {
    id: 'costDesc',
    label: 'Сначала дороже',
    orderBy: 'Cost DESC',
  },
  {
    id: 'nameAsc',
    label: 'По названию А–Я',
    orderBy: 'Name',
  },
  {
    id: 'createdDesc',
    label: 'Сначала новые',
    hint: 'Недавно созданные',
    orderBy: 'CreateDate DESC',
  },
];

export const DEFAULT_EVENT_LIST_SORT: EventListSortId = 'startAsc';

export function eventListSortById(id: EventListSortId | null | undefined): EventListSortOption {
  return EVENT_LIST_SORT_OPTIONS.find(o => o.id === id) ?? EVENT_LIST_SORT_OPTIONS[0];
}

export function eventListSortIdFromOrderBy(orderBy: string | null | undefined): EventListSortId {
  const raw = (orderBy ?? '').trim().toLowerCase();
  if (!raw) return DEFAULT_EVENT_LIST_SORT;
  const match = EVENT_LIST_SORT_OPTIONS.find(o => o.orderBy.toLowerCase() === raw);
  if (match) return match.id;
  if (raw.includes('agelimit') || raw.includes('age')) {
    return raw.includes('desc') ? 'ageDesc' : 'ageAsc';
  }
  if (raw.includes('cost') || raw.includes('price')) {
    return raw.includes('desc') ? 'costDesc' : 'costAsc';
  }
  if (raw.includes('name')) return 'nameAsc';
  if (raw.includes('create')) return 'createdDesc';
  if (raw.includes('start')) {
    return raw.includes('desc') ? 'startDesc' : 'startAsc';
  }
  return DEFAULT_EVENT_LIST_SORT;
}
