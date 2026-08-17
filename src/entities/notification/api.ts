// entities/notification/api.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';
import { parseNotificationPayload } from './parseNotification';
import type { IConnectionStats, INotification } from './types';

const BASE = '/api/notifications';

type RawPagedList<T> = PagedList<T> & {
  Total?: number;
  Result?: T[];
  PageIndex?: number;
  PageSize?: number;
};

function normalizePagedList<T>(
  raw: RawPagedList<T> | null | undefined,
  pageIndex: number,
  pageSize: number,
): PagedList<T> {
  const items = raw?.result ?? raw?.Result ?? [];
  return {
    pageIndex: raw?.pageIndex ?? raw?.PageIndex ?? pageIndex,
    pageSize: raw?.pageSize ?? raw?.PageSize ?? pageSize,
    total: raw?.total ?? raw?.Total ?? items.length,
    result: items,
  };
}

/** GET /api/notifications/my */
export async function fetchMyNotifications(options?: {
  pageIndex?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  type?: string;
}): Promise<PagedList<INotification>> {
  const pageIndex = options?.pageIndex ?? 0;
  const pageSize = options?.pageSize ?? 20;
  const params = new URLSearchParams();
  params.set('pageIndex', String(pageIndex));
  params.set('pageSize', String(pageSize));
  if (options?.unreadOnly) params.set('unreadOnly', 'true');
  if (options?.type) params.set('type', options.type);
  const data = await apiClient.get<RawPagedList<unknown>>(`${BASE}/my?${params}`);
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: page.result
      .map(item => parseNotificationPayload(item))
      .filter((n): n is INotification => n != null),
  };
}

/** GET /api/notifications/my/count */
export async function fetchMyNotificationsUnreadCount(): Promise<number> {
  const data = await apiClient.get<number>(`${BASE}/my/count?unreadOnly=true`);
  return Number(data.result ?? 0);
}

/** POST /api/notifications/send/{accountId} — тестовая отправка */
export async function sendTestNotification(
  accountId: string,
  body: { message: string; title?: string; type?: string },
): Promise<void> {
  await apiClient.post(`${BASE}/send/${accountId}`, body);
}

/** GET /api/notifications/read/{notificationId} */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.get(`${BASE}/read/${notificationId}`);
}

/** GET /api/notifications/read/all */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.get(`${BASE}/read/all`);
}

/** GET /api/notifications/connections/stats */
export async function fetchConnectionStats(): Promise<IConnectionStats> {
  const r = await apiClient.get<IConnectionStats>(`${BASE}/connections/stats`);
  const raw = r.result;
  return {
    totalConnectionsCount: raw?.totalConnectionsCount ?? (raw as { TotalConnectionsCount?: number })?.TotalConnectionsCount ?? null,
    connectedAccountCounts: raw?.connectedAccountCounts ?? (raw as { ConnectedAccountCounts?: number })?.ConnectedAccountCounts ?? null,
  };
}
