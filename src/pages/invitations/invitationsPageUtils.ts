// pages/invitations/invitationsPageUtils.ts

import type { IInvitation } from '@/entities/invitation/invitationsApi';

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

export function getEventTypes(event: unknown): Array<{ id: string; name: string; ico?: string; eventCategory?: { color?: string } }> {
  const e = event as Record<string, unknown>;
  const types = e?.eventTypes as unknown[] | undefined;
  if (types?.length) return types as ReturnType<typeof getEventTypes>;
  const single = e?.eventType;
  return single ? [single as ReturnType<typeof getEventTypes>[0]] : [];
}

export function getEventParams(event: unknown): {
  cost: number;
  ageLimit: number | null;
  maxPersonsCount: number | null;
  private: boolean;
  participantsCount: number | null;
} {
  const e = event as Record<string, unknown>;
  const p = (e?.parameters ?? {}) as Record<string, unknown>;
  return {
    cost: (p.cost as number) ?? 0,
    ageLimit: (p.ageLimit as number | null) ?? null,
    maxPersonsCount: (p.maxPersonsCount as number | null) ?? null,
    private: !!(p.private),
    participantsCount: (e.participantsCount as number | null) ?? null,
  };
}
