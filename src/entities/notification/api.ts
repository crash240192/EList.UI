// entities/notification/api.ts

import { apiClient } from '@/shared/api/client';
import type { IConnectionStats } from './types';

const BASE = '/api/notifications';

/** POST /api/notifications/send/{accountId} — тестовая отправка */
export async function sendTestNotification(
  accountId: string,
  body: { message: string; title?: string; type?: string },
): Promise<void> {
  await apiClient.post(`${BASE}/send/${accountId}`, body);
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
