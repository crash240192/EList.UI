// entities/organization/organizationSubscriptionApi.ts

import { apiClient } from '@/shared/api/client';

export interface IOrgNotifySettings {
  notifyEventCreated: boolean;
}

export interface IOrgSubscriptionOrganization {
  id: string;
  name: string;
  active: boolean;
}

export interface IOrgSubscriptionAccount {
  id: string;
  login: string;
  avatarId?: string | null;
}

export interface IOrgSubscriptionPersonInfo {
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
}

export interface IOrgSubscriptionItem {
  id?: string;
  organization: IOrgSubscriptionOrganization | null;
  account: IOrgSubscriptionAccount | null;
  personInfo: IOrgSubscriptionPersonInfo | null;
  notifySettings: IOrgNotifySettings | null;
}

export interface IOrgSubscriptionSearchParams {
  name?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface IOrgSubscriptionPage {
  items: IOrgSubscriptionItem[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

function mapAccount(raw: unknown): IOrgSubscriptionAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const acc = raw as Record<string, unknown>;
  const id = String(acc.id ?? acc.Id ?? '');
  if (!id) return null;
  const avatarId = acc.avatarId ?? acc.AvatarId;
  return {
    id,
    login: String(acc.login ?? acc.Login ?? ''),
    avatarId: avatarId === null || avatarId === '' ? null : (avatarId as string | undefined),
  };
}

function mapOrganization(raw: unknown): IOrgSubscriptionOrganization | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? o.Id ?? '');
  if (!id) return null;
  return {
    id,
    name: String(o.name ?? o.Name ?? ''),
    active: o.active !== false && o.Active !== false,
  };
}

function mapPerson(raw: unknown): IOrgSubscriptionPersonInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  return {
    firstName: (p.firstName ?? p.FirstName ?? null) as string | null,
    lastName: (p.lastName ?? p.LastName ?? null) as string | null,
    patronymic: (p.patronymic ?? p.Patronymic ?? null) as string | null,
  };
}

/** GET /api/organizationSubscriptions/getSubscriptionsCount/{accountId} */
export async function fetchOrgSubscriptionsCount(accountId: string): Promise<number> {
  try {
    const r = await apiClient.get<number>(
      `/api/organizationSubscriptions/getSubscriptionsCount/${accountId}`,
    );
    return r.result ?? 0;
  } catch {
    return 0;
  }
}

/** GET /api/organizationSubscriptions/getSubscribersCount/{organizationId} */
export async function fetchOrgSubscribersCount(organizationId: string): Promise<number> {
  try {
    const r = await apiClient.get<number>(
      `/api/organizationSubscriptions/getSubscribersCount/${organizationId}`,
    );
    return r.result ?? 0;
  } catch {
    return 0;
  }
}

/** GET /api/organizationSubscriptions/isSubscribed/{organizationId} */
export async function fetchIsSubscribedToOrganization(organizationId: string): Promise<boolean> {
  try {
    const r = await apiClient.get<boolean>(
      `/api/organizationSubscriptions/isSubscribed/${organizationId}`,
    );
    return Boolean(r.result);
  } catch {
    return false;
  }
}

/** POST /api/organizationSubscriptions/getSubscriptions */
export async function fetchOrgSubscriptions(
  accountId: string,
  params?: IOrgSubscriptionSearchParams,
): Promise<IOrgSubscriptionPage> {
  const pageSize = Math.max(1, params?.pageSize || 20);
  const pageIndex = params?.pageIndex ?? 0;
  try {
    const r = await apiClient.post<any>('/api/organizationSubscriptions/getSubscriptions', {
      accountId,
      name: params?.name?.trim() || undefined,
      pageIndex,
      pageIndes: pageIndex,
      pageSize,
    });
    const paged = r?.result ?? {};
    const list: any[] = paged?.result ?? [];
    return {
      items: list.map(item => ({
        id: item.id ?? item.Id,
        organization: mapOrganization(item.organization ?? item.Organization),
        account: null,
        personInfo: null,
        notifySettings: {
          notifyEventCreated: Boolean(
            item.notifyEventCreated ?? item.NotifyEventCreated ?? true,
          ),
        },
      })),
      total: paged?.total ?? list.length,
      pageIndex: paged?.pageIndex ?? pageIndex,
      pageSize: paged?.pageSize ?? pageSize,
    };
  } catch {
    return { items: [], total: 0, pageIndex, pageSize };
  }
}

/** POST /api/organizationSubscriptions/getSubscribers */
export async function fetchOrgSubscribers(
  organizationId: string,
  params?: IOrgSubscriptionSearchParams,
): Promise<IOrgSubscriptionPage> {
  const pageSize = Math.max(1, params?.pageSize || 20);
  const pageIndex = params?.pageIndex ?? 0;
  try {
    const r = await apiClient.post<any>('/api/organizationSubscriptions/getSubscribers', {
      organizationId,
      name: params?.name?.trim() || undefined,
      pageIndex,
      pageIndes: pageIndex,
      pageSize,
    });
    const paged = r?.result ?? {};
    const list: any[] = paged?.result ?? [];
    return {
      items: list.map(item => {
        const subscriber = item.subscriber ?? item.Subscriber ?? {};
        return {
          id: item.id ?? item.Id,
          organization: null,
          account: mapAccount(subscriber.account ?? subscriber.Account ?? subscriber),
          personInfo: mapPerson(subscriber.personInfo ?? subscriber.PersonInfo),
          notifySettings: null,
        };
      }),
      total: paged?.total ?? list.length,
      pageIndex: paged?.pageIndex ?? pageIndex,
      pageSize: paged?.pageSize ?? pageSize,
    };
  } catch {
    return { items: [], total: 0, pageIndex, pageSize };
  }
}

/** Подписаться на организацию */
export async function subscribeToOrganization(
  organizationId: string,
  notify: IOrgNotifySettings,
): Promise<void> {
  await apiClient.get(`/api/organizationSubscriptions/subscribe/${organizationId}`);
  await apiClient.put(`/api/organizationSubscriptions/update/${organizationId}`, notify);
}

/** PUT /api/organizationSubscriptions/update/{organizationId} */
export async function updateOrgSubscriptionNotify(
  organizationId: string,
  notify: IOrgNotifySettings,
): Promise<void> {
  await apiClient.put(`/api/organizationSubscriptions/update/${organizationId}`, notify);
}

/** DELETE /api/organizationSubscriptions/deleteSubscription/{organizationId} */
export async function unsubscribeFromOrganization(organizationId: string): Promise<void> {
  await apiClient.delete(`/api/organizationSubscriptions/deleteSubscription/${organizationId}`);
}
