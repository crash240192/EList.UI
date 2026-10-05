// entities/invitation/inviteEligibilityLabels.ts
// Единые подписи eligibility для InviteModal и ProfileInvite.

import { ApiErrorCode } from '@/shared/api/errorCodes';
import type { IInviteToEventEligibility } from './invitationsApi';

/** Нормализует reason/errorCode в короткий UI-текст. */
export function formatInviteEligibilityReason(
  reason: string | null | undefined,
  errorCode?: number,
): string | null {
  if (errorCode === ApiErrorCode.EventCancelled) return 'Мероприятие отменено';
  if (errorCode === ApiErrorCode.EventIsFull) return 'Мероприятие заполнено';

  const text = (reason ?? '').trim();
  if (!text) return null;

  if (/отменен/i.test(text)) return 'Мероприятие отменено';
  if (/максимальн|заполнен|мест/i.test(text) && /участ|заполн|человек/i.test(text)) {
    return 'Мероприятие заполнено';
  }
  return text;
}

export function eligibilitySubtitle(el: IInviteToEventEligibility | undefined): string | null {
  if (!el) return null;
  if (!el.allowed) {
    return formatInviteEligibilityReason(el.reason, el.errorCode) || 'Нельзя пригласить';
  }
  if (el.ticketsRequired) return 'Нужен билет';
  return null;
}
