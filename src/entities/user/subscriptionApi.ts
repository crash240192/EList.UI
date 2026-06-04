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
  /** Идентификатор записи подписки (для update/delete настроек) */
  subscriptionId: string;
  account: ISubscriptionAccount;
  personInfo: ISubscriptionPersonInfo | null;
  notifySettings: INotifySettings | null;
}

function mapSubscriptionItem(item: Record<string, unknown>): ISubscriptionItem {
  const subscribedTo = item.subscribedTo as Record<string, unknown> | undefined;
  const accountRaw = (subscribedTo?.account ?? item.account) as ISubscriptionAccount;
  const personInfo = (subscribedTo?.personInfo ?? item.personInfo ?? null) as ISubscriptionPersonInfo | null;
  const notify = item.notify as Record<string, unknown> | undefined;

  return {
    subscriptionId: String(
      item.id ?? item.Id ?? item.subscriptionId ?? item.SubscriptionId ?? '',
    ),
    account: accountRaw,
    personInfo,
    notifySettings: {
      notifyParticipated: Boolean(
        item.notifyParticipated
        ?? subscribedTo?.notifyParticipated
        ?? notify?.notifyParticipated,
      ),
      notifyEventCreated: Boolean(
        item.notifyEventCreated
        ?? subscribedTo?.notifyEventCreated
        ?? notify?.notifyEventCreated,
      ),
      notifySubscribed: Boolean(
        item.notifySubscribed
        ?? subscribedTo?.notifySubscribed
        ?? notify?.notifySubscribed,
      ),
    },
  };
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
    const list: unknown[] = paged?.result ?? [];
    return {
      items: list.map(row => mapSubscriptionItem(row as Record<string, unknown>)),
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
    const list: unknown[] = paged?.result ?? [];
    return {
      items: list.map(row => {
        const item = row as Record<string, unknown>;
        const subscriber = item.subscriber as Record<string, unknown> | undefined;
        const accountRaw = (subscriber?.account ?? item.account) as ISubscriptionAccount;
        const personInfo = (subscriber?.personInfo ?? item.personInfo ?? null) as ISubscriptionPersonInfo | null;
        return {
          subscriptionId: String(
            item.id ?? item.Id ?? item.subscriptionId ?? item.SubscriptionId ?? '',
          ),
          account: accountRaw,
          personInfo,
          notifySettings: null,
        };
      }),
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

/** PUT /api/subscriptions/update/{subscriptionId} */
export async function updateSubscriptionNotify(subscriptionId: string, notify: INotifySettings): Promise<void> {
  await apiClient.put(`/api/subscriptions/update/${subscriptionId}`, notify);
}

/** DELETE /api/subscriptions/deleteSubscription/{accountId} */
export async function unsubscribe(accountId: string): Promise<void> {
  await apiClient.delete(`/api/subscriptions/deleteSubscription/${accountId}`);
}
