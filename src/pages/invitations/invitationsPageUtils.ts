// pages/invitations/invitationsPageUtils.ts

import type { IInvitation, IInvitationEvent } from '@/entities/invitation/invitationsApi';
import type { IEventType } from '@/entities/event/types';

export type UrgencyKind = 'hot' | 'soon' | 'ok';

export function formatRelativeInviteTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatInvitationEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatInvitationEventDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDaysUntil(iso: string): number {
  const start = new Date(iso);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - now.getTime()) / 86_400_000);
}

export function getEventUrgency(startTime: string): { label: string; kind: UrgencyKind } | null {
  const days = getDaysUntil(startTime);
  if (days < 0) return null;
  if (days <= 2) return { label: days <= 1 ? (days === 0 ? 'сегодня' : 'завтра') : '2 дня', kind: 'hot' };
  if (days <= 14) return { label: `${days} дн.`, kind: 'soon' };
  if (days < 60) return { label: `${Math.ceil(days / 7)} нед.`, kind: 'ok' };
  return { label: `${Math.ceil(days / 30)} мес.`, kind: 'ok' };
}

export function findUrgentInvitation(items: IInvitation[]): IInvitation | null {
  let best: IInvitation | null = null;
  let bestDays = Infinity;
  for (const inv of items) {
    const days = getDaysUntil(inv.event.startTime);
    if (days >= 0 && days <= 2 && days < bestDays) {
      best = inv;
      bestDays = days;
    }
  }
  return best;
}

export function getEventTypes(event: IInvitationEvent | unknown): IEventType[] {
  const e = event as IInvitationEvent;
  if (e?.eventTypes?.length) return e.eventTypes;
  if (e?.eventType) return [e.eventType];
  return [];
}

export function getEventParams(event: IInvitationEvent | unknown): {
  cost: number;
  ageLimit: number | null;
  maxPersonsCount: number | null;
  private: boolean;
  participantsCount: number | null;
} {
  const e = event as IInvitationEvent;
  const p = e?.parameters;
  return {
    cost: p?.cost ?? 0,
    ageLimit: p?.ageLimit ?? null,
    maxPersonsCount: p?.maxPersonsCount ?? null,
    private: !!(p?.private),
    participantsCount: e?.participantsCount ?? null,
  };
}
