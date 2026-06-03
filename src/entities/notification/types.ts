// entities/notification/types.ts

import type { IEventSearchShortItem } from '@/entities/event/types';

/** Уведомление (модель notifications API) */
export interface INotification {
  id: string;
  eventId: string | null;
  relatedAccountId: string | null;
  type: string | number | null;
  title: string | null;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  /** Произвольный payload; для типов 0–3 — краткая карточка мероприятия */
  data: unknown;
  /** Распознанный data для EventCreated / Updated / Cancelled / Finished */
  eventShort?: IEventSearchShortItem | null;
}

export interface IConnectionStats {
  totalConnectionsCount: number | null;
  connectedAccountCounts: number | null;
}

export type NotificationWsStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error';
