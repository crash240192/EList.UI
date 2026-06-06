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
  /** Произвольный payload; для типов 0–3, 41–45 — краткая карточка мероприятия; для 60–62 — оценка */
  data: unknown;
  /** Распознанный data для типов с карточкой мероприятия в payload */
  eventShort?: IEventSearchShortItem | null;
  /** Распознанный data для NewEventRating / EventRatingChanged / EventRatingDeleted */
  ratingData?: INotificationRatingData | null;
}

/** data для уведомлений об оценке мероприятия (типы 60–62) */
export interface INotificationRatingData {
  id: string;
  accountId: string;
  eventId: string;
  comment: string | null;
  value: number;
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
