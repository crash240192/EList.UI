import type { IEventType } from '@/entities/event/types';
import type { Gender } from '@/shared/api/types';
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
  coverFocusX?: number | null;
  coverFocusY?: number | null;
  eventTypes?: IEventType[];
  eventType?: IEventType | null;
  parameters?: {
    cost?: number;
    priceMin?: number | null;
    priceMax?: number | null;
    ageLimit?: number | null;
    maxPersonsCount?: number | null;
    ticketsEnabled?: boolean;
    private?: boolean;
    allowedGender?: Gender | null;
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

export function readAllowedGender(source: {
  allowedGender?: unknown;
  AllowedGender?: unknown;
} | null | undefined): Gender | null {
  const value = source?.allowedGender ?? source?.AllowedGender;
  return value === 'Female' || value === 'Male' ? value : null;
}

export function getEventListParams(event: EventListItemData) {
  const p = event.parameters;
  const cost = p?.cost ?? 0;
  const priceMin = p?.priceMin != null && Number.isFinite(Number(p.priceMin))
    ? Number(p.priceMin)
    : cost;
  const priceMax = p?.priceMax != null && Number.isFinite(Number(p.priceMax))
    ? Number(p.priceMax)
    : priceMin;
  return {
    cost,
    priceMin,
    priceMax,
    ageLimit: p?.ageLimit ?? null,
    maxPersonsCount: p?.maxPersonsCount ?? null,
    participantsCount: event.participantsCount ?? null,
    isPrivate: Boolean(p?.private),
    allowedGender: readAllowedGender(p),
    ticketsEnabled: Boolean(p?.ticketsEnabled),
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

/** Диапазон цен: Бесплатно / X ₽ / X–Y ₽ */
export function formatEventListItemPrice(
  priceMin: number,
  priceMax?: number | null,
): { label: string; free: boolean } {
  const lo = Number.isFinite(priceMin) ? Math.max(0, priceMin) : 0;
  const hiRaw = priceMax != null && Number.isFinite(priceMax) ? Number(priceMax) : lo;
  const hi = Math.max(lo, hiRaw);
  if (lo <= 0 && hi <= 0) return { label: 'Бесплатно', free: true };
  if (lo === hi) {
    return { label: `${lo.toLocaleString('ru-RU')} ₽`, free: false };
  }
  return {
    label: `${lo.toLocaleString('ru-RU')}–${hi.toLocaleString('ru-RU')} ₽`,
    free: false,
  };
}

export function getEventListCoverBackground(event: EventListItemData): string {
  if (event.coverImageId || event.coverUrl) return '#111';
  if (event.colors?.length) {
    return buildEventCoverBackground(event.id, event.colors);
  }
  return getEventCoverBackground(event as Parameters<typeof getEventCoverBackground>[0]);
}
