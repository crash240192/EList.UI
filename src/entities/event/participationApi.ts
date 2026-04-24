// entities/event/participationApi.ts

import { apiClient } from '@/shared/api/client';

export interface IParticipantAccount {
  id: string;
  login: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  registrationDate: string;
  lastSeenDate: string | null;
  lastActionDate: string | null;
  walletId: string | null;
}

export interface IParticipantPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: 'Male' | 'Female' | null;
  birthDate: string | null;
}

export interface IParticipant {
  account: IParticipantAccount;
  personInfo: IParticipantPersonInfo | null;
}

// Плоская модель для отображения
export interface IParticipantView {
  accountId: string;
  login: string;
  firstName: string | null;
  lastName: string | null;
}

export interface IParticipantsSearchRequest {
  eventId: string;
  subscriberId?: string | null;    // вкладка «Я подписан»
  subscribedToId?: string | null;  // вкладка «Мои подписчики»
  name?: string | null;
  gender?: 'Male' | 'Female' | null;
  age?: number | null;
  pageIndex: number;               // начиная с 1
  pageSize: number;
}

export interface IParticipantsPage {
  items: IParticipantView[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export async function fetchEventParticipantsPage(req: IParticipantsSearchRequest): Promise<IParticipantsPage> {
  const data = await apiClient.post<any>('/api/participations/eventParticipants', req);
  const paged = data?.result ?? data;
  const rawList: IParticipant[] = paged?.result ?? [];
  const items = rawList.map(p => ({
    accountId: p.account.id,
    login:     p.account.login,
    firstName: p.personInfo?.firstName ?? null,
    lastName:  p.personInfo?.lastName  ?? null,
  }));
  return {
    items,
    total:     paged?.total     ?? items.length,
    pageIndex: paged?.pageIndex ?? req.pageIndex,
    pageSize:  paged?.pageSize  ?? req.pageSize,
  };
}

// Обратная совместимость — загружает первую страницу для превью на EventPage
export async function fetchEventParticipants(eventId: string): Promise<IParticipantView[]> {
  const page = await fetchEventParticipantsPage({ eventId, pageIndex: 0, pageSize: 20 });
  return page.items;
}

export async function participateEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/participate/${eventId}`);
}

export async function leaveEvent(eventId: string): Promise<void> {
  await apiClient.get(`/api/participations/leave/${eventId}`);
}

/**
 * GET /api/events/eventTypes/byEvent/{eventId}
 */
export async function fetchEventTypesByEvent(eventId: string): Promise<Array<{
  id: string;
  eventCategoryId: string;
  eventCategory?: { id: string } | null;
}>> {
  try {
    const data = await apiClient.get<any[]>(`/api/events/eventTypes/byEvent/${eventId}`);
    const result = data.result;
    if (!Array.isArray(result)) return [];
    return result.map((t: any) => ({
      id:              t.id,
      eventCategoryId: t.eventCategoryId ?? t.eventCategory?.id ?? '',
      eventCategory:   t.eventCategory ?? null,
    }));
  } catch { return []; }
}
