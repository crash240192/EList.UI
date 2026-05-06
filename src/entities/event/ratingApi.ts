// entities/event/ratingApi.ts

import { apiClient } from '@/shared/api/client';

export type RatingType = 'Expectation' | 'Summary';

export interface IRatingVoteRequest {
  id?: string;
  accountId: string;
  eventId: string;
  comment: string;
  value: number;
  ratingType: RatingType;
}

export interface IRatingAccount {
  id: string;
  active: boolean;
  login: string;
}

export interface IRatingPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: 'Male' | 'Female' | null;
  birthDate: string | null;
}

export interface IRatingItem {
  id: string;
  accountId: string;
  eventId: string;
  comment: string;
  value: number;
  ratingType: RatingType;
  account: IRatingAccount;
  personInfo: IRatingPersonInfo | null;
}

export interface IRatingPage {
  items: IRatingItem[];
  total: number;
  resultRating: number;
}

export async function fetchEventRating(
  eventId: string,
  ratingType: RatingType,
  pageIndex = 0,
  pageSize = 20,
): Promise<IRatingPage> {
  const params = new URLSearchParams({
    eventId,
    eventRatingType: ratingType.toLowerCase(),
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  });
  const data = await apiClient.get<any>(`/api/Rating/events/getRating?${params}`);
  const paged = data?.result ?? data;
  return {
    items:        paged?.result       ?? [],
    total:        paged?.total        ?? 0,
    resultRating: paged?.resultRating ?? 0,
  };
}

// Бэкенд объявляет метод как GET с телом (нестандартно).
// Используем POST — ASP.NET Core обычно принимает оба метода для [HttpGet].
// Если сервер вернёт 405, замените на getWithBody.
export async function voteEventRating(req: IRatingVoteRequest): Promise<void> {
  await apiClient.post('/api/Rating/events/vote', req);
}
