import type { IEvent } from '@/entities/event';
import type { IContactDataItem } from '@/entities/user/profileApi';
import { isEventFinished } from '@/features/event/RatingWidget';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';

export type UserEventsScope = 'created' | 'participating';
export type UserEventsPhase = 'upcoming' | 'past';

export function getContactIcon(contact: IContactDataItem): string {
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (name.includes('email') || name.includes('почт') || name.includes('mail')) return '📧';
  if (name.includes('telegram') || name.includes('tg')) return '💬';
  if (name.includes('vk') || name.includes('вконтакте')) return '📱';
  if (name.includes('whatsapp')) return '📱';
  if (name.includes('телефон') || name.includes('phone') || name.includes('мобил')) return '📞';
  if (name.includes('сайт') || name.includes('site') || name.includes('web')) return '🌐';
  if (name.includes('город') || name.includes('city') || name.includes('location')) return '📍';
  return '👤';
}

export function isContactLink(contact: IContactDataItem): boolean {
  const value = contact.value.trim();
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return value.includes('@');
  }
  if (name.includes('telegram') || name.includes('tg') || name.includes('vk') || name.includes('сайт') || name.includes('site')) {
    return true;
  }
  return /^https?:\/\//i.test(value);
}

export function formatContactHref(contact: IContactDataItem): string | null {
  const value = contact.value.trim();
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (/^https?:\/\//i.test(value)) return value;
  if (name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return `mailto:${value}`;
  }
  if (name.includes('telegram') || name.includes('tg')) {
    const handle = value.replace(/^@/, '');
    return `https://t.me/${handle}`;
  }
  return null;
}

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

export function getUpcomingPreview(events: IEvent[], scope: UserEventsScope, limit = 3) {
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

export function getEventTypeLabels(event: IEvent): string[] {
  const types = (event.eventTypes?.length ? event.eventTypes : event.eventType ? [event.eventType] : [])
    .map(t => t.name)
    .filter(Boolean);
  return types.slice(0, 2);
}
