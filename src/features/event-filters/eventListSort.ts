/** Сортировка списка мероприятий (orderBy для /api/events/search). */

export type EventListSortId =
  | 'startAsc'
  | 'startDesc'
  | 'costAsc'
  | 'costDesc'
  | 'nameAsc'
  | 'createdDesc'
  | 'ratingDesc';

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
    orderBy: 'StartTime',
  },
  {
    id: 'startDesc',
    label: 'Сначала поздние',
    orderBy: 'StartTime DESC',
  },
  {
    id: 'costAsc',
    label: 'Дешевле',
    orderBy: 'Cost',
  },
  {
    id: 'costDesc',
    label: 'Дороже',
    orderBy: 'Cost DESC',
  },
  {
    id: 'nameAsc',
    label: 'По названию',
    orderBy: 'Name',
  },
  {
    id: 'createdDesc',
    label: 'По дате создания',
    orderBy: 'CreateDate DESC',
  },
  {
    id: 'ratingDesc',
    label: 'По рейтингу',
    orderBy: 'Rating DESC',
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
  if (raw.includes('rating')) return 'ratingDesc';
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
