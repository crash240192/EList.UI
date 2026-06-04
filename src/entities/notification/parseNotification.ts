// entities/notification/parseNotification.ts

import type { INotification } from './types';
import { isEventNotificationType, parseEventNotificationData } from './eventData';

function str(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseType(v: unknown): string | number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== '') return n;
  return String(v);
}

/** Разбор JSON с WS / CommandResult (camelCase или PascalCase) */
export function parseNotificationPayload(raw: unknown): INotification | null {
  if (!raw || typeof raw !== 'object') return null;

  const o = raw as Record<string, unknown>;

  // CommandResult<Notification>
  if ('result' in o && o.result && typeof o.result === 'object') {
    return parseNotificationPayload(o.result);
  }
  if ('Result' in o && o.Result && typeof o.Result === 'object') {
    return parseNotificationPayload(o.Result);
  }

  const id = o.id ?? o.Id;
  if (id == null) return null;

  const created = o.createdAt ?? o.CreatedAt;
  const read = o.readAt ?? o.ReadAt;
  const type = parseType(o.type ?? o.Type);
  const rawData = o.data ?? o.Data ?? null;
  const eventShort =
    isEventNotificationType(type) && rawData != null
      ? parseEventNotificationData(rawData)
      : null;

  return {
    id: String(id),
    eventId: str(o.eventId ?? o.EventId),
    relatedAccountId: str(o.relatedAccountId ?? o.RelatedAccountId),
    type,
    title: str(o.title ?? o.Title),
    message: str(o.message ?? o.Message),
    createdAt: created ? String(created) : new Date().toISOString(),
    readAt: read != null && read !== '' ? String(read) : null,
    data: rawData,
    eventShort,
  };
}

/** Извлечь уведомление из произвольного WS-сообщения */
export function parseWsNotificationMessage(data: string): INotification | null {
  const trimmed = data.trim();
  if (!trimmed) return null;

  try {
    const json: unknown = JSON.parse(trimmed);
    if (Array.isArray(json)) {
      for (const item of json) {
        const n = parseNotificationPayload(item);
        if (n) return n;
      }
      return null;
    }
    return parseNotificationPayload(json);
  } catch {
    return null;
  }
}
