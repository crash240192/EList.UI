// entities/notification/eventData.ts

import type { IEventSearchShortItem } from '@/entities/event/types';

export const NOTIFICATION_TYPE_NEW_INVITATION = 51;

/** Типы уведомлений, в data которых — краткая карточка мероприятия (как search/short) */
export const EVENT_NOTIFICATION_TYPES = new Set([0, 1, 2, 3]);

export function isNewInvitationNotification(type: string | number | null | undefined): boolean {
  return Number(type) === NOTIFICATION_TYPE_NEW_INVITATION;
}

export function isEventNotificationType(type: string | number | null | undefined): boolean {
  if (type == null || type === '') return false;
  const n = Number(type);
  return Number.isFinite(n) && EVENT_NOTIFICATION_TYPES.has(n);
}

/** data → IEventSearchShortItem (camelCase / PascalCase) */
export function parseEventNotificationData(raw: unknown): IEventSearchShortItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const o = raw as Record<string, unknown>;
  const id = o.id ?? o.Id;
  if (id == null || id === '') return null;

  const name = o.name ?? o.Name;
  const lat = o.latitude ?? o.Latitude;
  const lng = o.longitude ?? o.Longitude;
  if (lat == null || lng == null) return null;

  const colorsRaw = o.colors ?? o.Colors;
  const colors = Array.isArray(colorsRaw)
    ? colorsRaw.filter((c): c is string => typeof c === 'string' && c.length > 0)
    : [];

  const start = o.startTime ?? o.StartTime;
  const startTime =
    start != null && start !== '' ? String(start) : undefined;

  return {
    id: String(id),
    name: typeof name === 'string' ? name : '',
    latitude: Number(lat),
    longitude: Number(lng),
    colors,
    ...(startTime ? { startTime } : {}),
  };
}

export function getNotificationEventId(
  n: { eventId: string | null; eventShort?: IEventSearchShortItem | null },
): string | null {
  return n.eventId ?? n.eventShort?.id ?? null;
}
