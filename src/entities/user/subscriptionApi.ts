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

// Один элемент списка подписок/подписчиков
export interface ISubscriptionItem {
  account: ISubscriptionAccount;
  personInfo: ISubscriptionPersonInfo | null;
}

export interface INotifySettings {
  notifyParticipated: boolean;
  notifyEventCreated: boolean;
  notifySubscribed:   boolean;
}

// ---- API ----

/** GET /api/subscriptions/getSubscriptionsCount — кол-во подписок */
export async function fetchSubscriptionsCount(accountId?: string): Promise<number> {
  try {
    const path = accountId
      ? `/api/subscriptions/getSubscriptionsCount/${accountId}`
      : '/api/subscriptions/getSubscriptionsCount';
    const r = await apiClient.get<number>(path);
    return r.result ?? 0;
  } catch { return 0; }
}

/** GET /api/subscriptions/getSubscribersCount — кол-во подписчиков */
export async function fetchSubscribersCount(accountId?: string): Promise<number> {
  try {
    const path = accountId
      ? `/api/subscriptions/getSubscribersCount/${accountId}`
      : '/api/subscriptions/getSubscribersCount';
    const r = await apiClient.get<number>(path);
    return r.result ?? 0;
  } catch { return 0; }
}

/** GET /api/subscriptions/getSubscriptions/{accountId} */
export async function fetchSubscriptions(accountId: string): Promise<ISubscriptionItem[]> {
  try {
    const r = await apiClient.get<any>(`/api/subscriptions/getSubscriptions/${accountId}`);
    const list = r?.result?.result ?? r?.result ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const src = item.subscribedTo ?? item;
      return { account: src.account, personInfo: src.personInfo ?? null };
    });
  } catch { return []; }
}

/** GET /api/subscriptions/getSubscribers/{accountId} */
export async function fetchSubscribers(accountId: string): Promise<ISubscriptionItem[]> {
  try {
    const r = await apiClient.get<any>(`/api/subscriptions/getSubscribers/${accountId}`);
    const list = r?.result?.result ?? r?.result ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const src = item.subscriber ?? item;
      return { account: src.account, personInfo: src.personInfo ?? null };
    });
  } catch { return []; }
}

/**
 * Подписаться + задать настройки уведомлений.
 * 1. GET /api/subscriptions/subscribe/{accountId}
 * 2. PUT /api/subscriptions/update/{accountId}  (с настройками)
 */
export async function subscribe(accountId: string, notify: INotifySettings): Promise<void> {
  await apiClient.get(`/api/subscriptions/subscribe/${accountId}`);
  await apiClient.put(`/api/subscriptions/update/${accountId}`, notify);
}

/** DELETE /api/subscriptions/deleteSubscription/{accountId} */
export async function unsubscribe(accountId: string): Promise<void> {
  await apiClient.delete(`/api/subscriptions/deleteSubscription/${accountId}`);
}
