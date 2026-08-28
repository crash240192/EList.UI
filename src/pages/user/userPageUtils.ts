import type { IEvent, IEventType } from '@/entities/event';
import { isEventFinished } from '@/features/event/RatingWidget';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';

export type { UserEventsScope } from '@/features/event-list/eventOwnerSearchParams';
export type UserEventsPhase = 'upcoming' | 'past';

export {
  formatContactHref,
  getContactIconKind,
  isContactLink,
  type ContactIconKind,
} from '@/shared/lib/contactDisplay';

export function formatShortEventDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(new Date(iso));
}

export function formatEventListDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function splitEventsByPhase(events: IEvent[], phase: UserEventsPhase): IEvent[] {
  const upcoming = events.filter(ev => !isEventFinished(ev.startTime, ev.endTime));
  const past = events.filter(ev => isEventFinished(ev.startTime, ev.endTime));
  const list = phase === 'upcoming' ? upcoming : past;

  return [...list].sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return phase === 'upcoming' ? aTime - bTime : bTime - aTime;
  });
}

export function getUpcomingPreview(
  events: IEvent[],
  scope: 'created' | 'participating',
  limit: number,
): Array<{ event: IEvent; scope: 'created' | 'participating' }> {
  return splitEventsByPhase(events, 'upcoming')
    .slice(0, limit)
    .map(event => ({ event, scope }));
}

export function getEventCoverStyle(event: IEvent): string {
  if (event.coverImageId || event.coverUrl) return '#111';
  return getEventCoverBackground(event);
}

export function formatEventPrice(cost: number): { label: string; free: boolean } {
  if (cost === 0) return { label: 'Бесплатно', free: true };
  return { label: `${cost.toLocaleString('ru-RU')} ₽`, free: false };
}

export function getEventTypes(event: IEvent): IEventType[] {
  const types = event.eventTypes?.length
    ? event.eventTypes
    : event.eventType
      ? [event.eventType]
      : [];
  return types.slice(0, 2);
}
