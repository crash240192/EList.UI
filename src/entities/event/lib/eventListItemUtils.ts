import type { IEventType } from '@/entities/event/types';
import { getEventCoverBackground, buildEventCoverBackground } from '@/shared/lib/eventCoverGradient';

/** Максимум чипов типов на странице события, превью и в списке */
export const EVENT_TYPE_CHIPS_MAX = 6;

export interface EventListItemData {
  id: string;
  name: string;
  startTime?: string | null;
  address?: string | null;
  coverImageId?: string | null;
  coverUrl?: string | null;
  eventTypes?: IEventType[];
  eventType?: IEventType | null;
  parameters?: {
    cost?: number;
    ageLimit?: number | null;
    maxPersonsCount?: number | null;
    ticketsEnabled?: boolean;
  } | null;
  participantsCount?: number | null;
  colors?: string[];
}

/** Все типы мероприятия (без лимита) — для карточки с обрезкой по ширине строки */
export function getEventTypes(event: EventListItemData): IEventType[] {
  if (event.eventTypes?.length) return event.eventTypes;
  if (event.eventType) return [event.eventType];
  return [];
}

export function getEventListTypes(
  event: EventListItemData,
  limit: number = EVENT_TYPE_CHIPS_MAX,
): IEventType[] {
  return getEventTypes(event).slice(0, limit);
}

export function getEventListParams(event: EventListItemData) {
  const p = event.parameters;
  return {
    cost: p?.cost ?? 0,
    ageLimit: p?.ageLimit ?? null,
    maxPersonsCount: p?.maxPersonsCount ?? null,
    participantsCount: event.participantsCount ?? null,
  };
}

export function formatEventListItemDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatEventListItemPrice(cost: number): { label: string; free: boolean } {
  if (cost === 0) return { label: 'Бесплатно', free: true };
  return { label: `${cost.toLocaleString('ru-RU')} ₽`, free: false };
}

export function getEventListCoverBackground(event: EventListItemData): string {
  if (event.coverImageId || event.coverUrl) return '#111';
  if (event.colors?.length) {
    return buildEventCoverBackground(event.id, event.colors);
  }
  return getEventCoverBackground(event as Parameters<typeof getEventCoverBackground>[0]);
}
