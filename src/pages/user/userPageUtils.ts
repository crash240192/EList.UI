import type { IEvent, IEventType } from '@/entities/event';
import type { IContactDataItem } from '@/entities/user/profileApi';
import { isEventFinished } from '@/features/event/RatingWidget';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';

export type UserEventsScope = 'all' | 'created' | 'participating';
export type UserEventsPhase = 'upcoming' | 'past';
export type ContactIconKind = 'email' | 'telegram' | 'phone' | 'site' | 'location' | 'user';

export function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1a2e' : '#ffffff';
}

export function getContactIconKind(contact: IContactDataItem): ContactIconKind {
  const name = (
    contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? contact.contactType?.namePath
    ?? ''
  ).toLowerCase();

  if (name.includes('email') || name.includes('почт') || name.includes('mail')) return 'email';
  if (name.includes('telegram') || name.includes('tg') || name.includes('vk') || name.includes('вконтакте') || name.includes('whatsapp')) return 'telegram';
  if (name.includes('телефон') || name.includes('phone') || name.includes('мобил')) return 'phone';
  if (name.includes('сайт') || name.includes('site') || name.includes('web')) return 'site';
  if (name.includes('город') || name.includes('city') || name.includes('location')) return 'location';
  return 'user';
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

export function mergeUserEvents(created: IEvent[], participating: IEvent[]): IEvent[] {
  const seen = new Set<string>();
  const merged: IEvent[] = [];
  for (const event of [...created, ...participating]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
  }
  return merged;
}

export function countUniqueUserEvents(created: IEvent[], participating: IEvent[]): number {
  const ids = new Set<string>();
  created.forEach(e => ids.add(e.id));
  participating.forEach(e => ids.add(e.id));
  return ids.size;
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
