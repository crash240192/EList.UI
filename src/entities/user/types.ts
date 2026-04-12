// entities/user/types.ts

import type { Gender } from '@/shared/api/types';

export interface IPersonInfo {
  id: string;
  accountId: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  gender: Gender | null;
  birthDate: string | null;
}

export interface IAccount {
  id: string;
  login: string;          // nickname
  personInfo?: IPersonInfo | null;
  /** URL аватара */
  avatarUrl?: string | null;
  /** Рейтинг как организатора */
  organizerRating?: number | null;
  /** Рейтинг как посетителя */
  visitorRating?: number | null;
  /** Кол-во подписчиков */
  followersCount?: number;
  /** Кол-во подписок */
  followingCount?: number;
}

export interface IContact {
  id: string;
  typeId: string;
  typeName?: string;    // напр. "Telegram", "Email"
  value: string;
  isPublic?: boolean;
}

export interface ISubscription {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}
