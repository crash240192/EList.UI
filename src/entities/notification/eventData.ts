// entities/notification/eventData.ts

import type { IEventSearchShortItem } from '@/entities/event/types';
import type { INotificationRatingData } from './types';

export const NOTIFICATION_TYPE_NEW_INVITATION = 51;

/** EventCreated / Updated / Cancelled / Finished */
export const EVENT_LIFECYCLE_TYPES = new Set([0, 1, 2, 3]);

/** AddedToBlackList … NotInWhiteList */
export const BW_LIST_NOTIFICATION_TYPES = new Set([41, 42, 43, 44, 45]);

/** NewEventRating / EventRatingChanged / EventRatingDeleted */
export const RATING_NOTIFICATION_TYPES = new Set([60, 61, 62]);

/** Типы, в data которых — краткая карточка мероприятия (как search/short) */
export const EVENT_SHORT_DATA_TYPES = new Set([
  ...EVENT_LIFECYCLE_TYPES,
  ...BW_LIST_NOTIFICATION_TYPES,
]);

export function isNewInvitationNotification(type: string | number | null | undefined): boolean {
  return Number(type) === NOTIFICATION_TYPE_NEW_INVITATION;
}

export function isEventShortDataType(type: string | number | null | undefined): boolean {
  if (type == null || type === '') return false;
  const n = Number(type);
  return Number.isFinite(n) && EVENT_SHORT_DATA_TYPES.has(n);
}

/** @deprecated alias */
export function isEventNotificationType(type: string | number | null | undefined): boolean {
  return isEventShortDataType(type);
}

export function isRatingNotificationType(type: string | number | null | undefined): boolean {
  if (type == null || type === '') return false;
  const n = Number(type);
  return Number.isFinite(n) && RATING_NOTIFICATION_TYPES.has(n);
}

export function isEventPageNotificationType(type: string | number | null | undefined): boolean {
  if (type == null || type === '') return false;
  const n = Number(type);
  return Number.isFinite(n) && (EVENT_SHORT_DATA_TYPES.has(n) || RATING_NOTIFICATION_TYPES.has(n));
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

/** data → INotificationRatingData (типы 60–62) */
export function parseRatingNotificationData(raw: unknown): INotificationRatingData | null {
  if (!raw || typeof raw !== 'object') return null;

  const o = raw as Record<string, unknown>;
  const eventId = o.eventId ?? o.EventId;
  if (eventId == null || eventId === '') return null;

  const id = o.id ?? o.Id;
  const accountId = o.accountId ?? o.AccountId;
  const commentRaw = o.comment ?? o.Comment;
  const valueRaw = o.value ?? o.Value;

  return {
    id: id != null && id !== '' ? String(id) : '',
    accountId: accountId != null && accountId !== '' ? String(accountId) : '',
    eventId: String(eventId),
    comment: typeof commentRaw === 'string' && commentRaw.length > 0 ? commentRaw : null,
    value: Number(valueRaw) || 0,
  };
}

export function getNotificationEventId(
  n: {
    eventId: string | null;
    eventShort?: IEventSearchShortItem | null;
    ratingData?: INotificationRatingData | null;
    type?: string | number | null;
    data?: unknown;
  },
): string | null {
  if (n.eventId) return n.eventId;
  if (n.eventShort?.id) return n.eventShort.id;
  if (n.ratingData?.eventId) return n.ratingData.eventId;
  if (isRatingNotificationType(n.type) && n.data != null) {
    return parseRatingNotificationData(n.data)?.eventId ?? null;
  }
  return null;
}
