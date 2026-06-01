// entities/notification/types.ts

/** Уведомление (модель notifications API) */
export interface INotification {
  id: string;
  eventId: string | null;
  relatedAccountId: string | null;
  type: string | null;
  title: string | null;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  data: unknown;
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
