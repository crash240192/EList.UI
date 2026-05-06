// entities/user/subscriptionApi.ts

import { apiClient } from '@/shared/api/client';

// ---- Типы ----

export interface ISubscriptionAccount {
  id: string;
  login: string;
}

export interface ISubscriptionPersonInfo {
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
}

export interface ISubscriptionItem {
  account: ISubscriptionAccount;
  personInfo: ISubscriptionPersonInfo | null;
}

export interface ISubscriptionSearchParams {
  name?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface ISubscriptionPage {
  items: ISubscriptionItem[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface INotifySettings {
  notifyParticipated: boolean;
  notifyEventCreated: boolean;
  notifySubscribed:   boolean;
}

// ---- API ----

/** GET /api/subscriptions/getSubscriptionsCount */
export async function fetchSubscriptionsCount(accountId?: string): Promise<number> {
  try {
    const path = accountId
      ? `/api/subscriptions/getSubscriptionsCount/${accountId}`
      : '/api/subscriptions/getSubscriptionsCount';
    const r = await apiClient.get<number>(path);
    return r.result ?? 0;
  } catch { return 0; }
}

/** GET /api/subscriptions/getSubscribersCount */
export async function fetchSubscribersCount(accountId?: string): Promise<number> {
  try {
    const path = accountId
      ? `/api/subscriptions/getSubscribersCount/${accountId}`
      : '/api/subscriptions/getSubscribersCount';
    const r = await apiClient.get<number>(path);
    return r.result ?? 0;
  } catch { return 0; }
}

/** POST /api/subscriptions/getSubscriptions */
export async function fetchSubscriptions(
  accountId: string,
  params?: ISubscriptionSearchParams,
): Promise<ISubscriptionPage> {
  const pageSize  = Math.max(1, params?.pageSize  || 20);
  const pageIndex = params?.pageIndex ?? 0;
  try {
    const r = await apiClient.post<any>('/api/subscriptions/getSubscriptions', {
      accountId,
      name:      params?.name?.trim() || undefined,
      pageIndex,
      pageSize,
    });
    const paged = r?.result ?? {};
    const list: any[] = paged?.result ?? [];
    return {
      items: list.map(item => ({
        account:    item.subscribedTo?.account    ?? item.account,
        personInfo: item.subscribedTo?.personInfo ?? item.personInfo ?? null,
      })),
      total:     paged?.total     ?? list.length,
      pageIndex: paged?.pageIndex ?? pageIndex,
      pageSize:  paged?.pageSize  ?? pageSize,
    };
  } catch { return { items: [], total: 0, pageIndex, pageSize }; }
}

/** POST /api/subscriptions/getSubscribers */
export async function fetchSubscribers(
  accountId: string,
  params?: ISubscriptionSearchParams,
): Promise<ISubscriptionPage> {
  const pageSize  = Math.max(1, params?.pageSize  || 20);
  const pageIndex = params?.pageIndex ?? 0;
  try {
    const r = await apiClient.post<any>('/api/subscriptions/getSubscribers', {
      accountId,
      name:      params?.name?.trim() || undefined,
      pageIndex,
      pageSize,
    });
    const paged = r?.result ?? {};
    const list: any[] = paged?.result ?? [];
    return {
      items: list.map(item => ({
        account:    item.subscriber?.account    ?? item.account,
        personInfo: item.subscriber?.personInfo ?? item.personInfo ?? null,
      })),
      total:     paged?.total     ?? list.length,
      pageIndex: paged?.pageIndex ?? pageIndex,
      pageSize:  paged?.pageSize  ?? pageSize,
    };
  } catch { return { items: [], total: 0, pageIndex, pageSize }; }
}

/** Подписаться */
export async function subscribe(accountId: string, notify: INotifySettings): Promise<void> {
  await apiClient.get(`/api/subscriptions/subscribe/${accountId}`);
  await apiClient.put(`/api/subscriptions/update/${accountId}`, notify);
}

/** DELETE /api/subscriptions/deleteSubscription/{accountId} */
export async function unsubscribe(accountId: string): Promise<void> {
  await apiClient.delete(`/api/subscriptions/deleteSubscription/${accountId}`);
}
