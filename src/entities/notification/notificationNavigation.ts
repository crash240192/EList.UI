// entities/notification/notificationNavigation.ts

import type { INotification } from './types';
import {
  getNotificationEventId,
  isEventPageNotificationType,
  isNewInvitationNotification,
  NOTIFICATION_TYPE_NEW_INVITATION,
} from './eventData';
import {
  contentReportNotificationTypeLabel,
  isContentReportNotificationType,
  NOTIFICATION_TYPE_CONTENT_REPORT_ACCOUNT_SUSPENDED,
  NOTIFICATION_TYPE_CONTENT_REPORT_AVATAR_RESET,
  NOTIFICATION_TYPE_CONTENT_REPORT_CONTENT_MODERATED,
  NOTIFICATION_TYPE_CONTENT_REPORT_FILED_AGAINST_YOU,
  NOTIFICATION_TYPE_CONTENT_REPORT_NEW_ORG_QUEUE,
  NOTIFICATION_TYPE_CONTENT_REPORT_NEW_PLATFORM_QUEUE,
  NOTIFICATION_TYPE_CONTENT_REPORT_ORG_REMOVED,
  NOTIFICATION_TYPE_CONTENT_REPORT_ORG_SUSPENDED,
  NOTIFICATION_TYPE_CONTENT_REPORT_PENALTY_ISSUED,
  NOTIFICATION_TYPE_CONTENT_REPORT_REVIEWED,
  NOTIFICATION_TYPE_CONTENT_REPORT_WARNING_ISSUED,
  notificationTypeKey,
  parseContentReportNotificationData,
} from './contentReportNotification';

export {
  NOTIFICATION_TYPE_NEW_INVITATION,
  isNewInvitationNotification,
};

/** NewSubscription */
export const NOTIFICATION_TYPE_NEW_SUBSCRIPTION = 10;
/** Unsubscribed */
export const NOTIFICATION_TYPE_UNSUBSCRIBED = 11;
/** RelatedPersonSubscribed */
export const NOTIFICATION_TYPE_RELATED_PERSON_SUBSCRIBED = 12;
/** RelatedPersonUnsubscribed */
export const NOTIFICATION_TYPE_RELATED_PERSON_UNSUBSCRIBED = 13;
/** Participated */
export const NOTIFICATION_TYPE_PARTICIPATED = 20;
/** EventLeft */
export const NOTIFICATION_TYPE_EVENT_LEFT = 21;

const USER_PROFILE_TYPES = new Set([
  NOTIFICATION_TYPE_NEW_SUBSCRIPTION,
  NOTIFICATION_TYPE_UNSUBSCRIBED,
  NOTIFICATION_TYPE_RELATED_PERSON_SUBSCRIBED,
  NOTIFICATION_TYPE_RELATED_PERSON_UNSUBSCRIBED,
]);

const EVENT_PAGE_TYPES = new Set([
  NOTIFICATION_TYPE_PARTICIPATED,
  NOTIFICATION_TYPE_EVENT_LEFT,
]);

export type NotificationNavTarget =
  | { kind: 'invitations' }
  | { kind: 'event'; eventId: string }
  | { kind: 'user'; accountId: string }
  | { kind: 'my-reports'; reportId?: string }
  | { kind: 'reports-against-me'; reportId?: string }
  | { kind: 'admin-moderation'; reportId?: string }
  | { kind: 'event-reports'; eventId: string }
  | { kind: 'organization'; organizationId: string }
  | { kind: 'settings-moderation' };

export function notificationTypeLabel(type: INotification['type']): string {
  if (type == null) return 'Уведомление';
  if (isContentReportNotificationType(type)) {
    return contentReportNotificationTypeLabel(type);
  }
  if (type === 'EventRestored') return 'Событие восстановлено';
  switch (Number(type)) {
    case 0: return 'Создано событие';
    case 1: return 'Событие обновлено';
    case 2: return 'Событие отменено';
    case 3: return 'Событие завершено';
    case 4: return 'Событие восстановлено';
    case NOTIFICATION_TYPE_NEW_SUBSCRIPTION: return 'На вас подписались';
    case NOTIFICATION_TYPE_UNSUBSCRIBED: return 'От вас отписались';
    case NOTIFICATION_TYPE_RELATED_PERSON_SUBSCRIBED:
      return 'Подписка у пользователя из ваших подписок';
    case NOTIFICATION_TYPE_RELATED_PERSON_UNSUBSCRIBED:
      return 'Отписка у пользователя из ваших подписок';
    case NOTIFICATION_TYPE_PARTICIPATED: return 'Участие в мероприятии';
    case NOTIFICATION_TYPE_EVENT_LEFT: return 'Выход из мероприятия';
    case 31: return 'Новый ответ в обсуждении';
    case 41: return 'Добавлен в чёрный список';
    case 42: return 'Добавлен в белый список';
    case 43: return 'Удалён из чёрного списка';
    case 44: return 'Удалён из белого списка';
    case 45: return 'Нет в белом списке';
    case 60: return 'Новая оценка мероприятия';
    case 61: return 'Оценка изменена';
    case 62: return 'Оценка удалена';
    case NOTIFICATION_TYPE_NEW_INVITATION: return 'Новое приглашение';
    default: return String(type);
  }
}

/** Куда переходить по клику на уведомление */
export function getNotificationNavigationTarget(
  n: INotification,
): NotificationNavTarget | null {
  const typeNum = Number(n.type);
  const typeKey = notificationTypeKey(n.type);
  const reportData = parseContentReportNotificationData(n.data);
  const reportId = reportData?.reportId ?? undefined;

  if (isContentReportNotificationType(n.type)) {
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_REVIEWED
      || typeKey === 'ContentReportReviewed'
    ) {
      return { kind: 'my-reports', reportId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_NEW_ORG_QUEUE
      || typeKey === 'ContentReportNewInOrganizerQueue'
    ) {
      const eventId = reportData?.eventId ?? n.eventId;
      if (eventId) return { kind: 'event-reports', eventId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_NEW_PLATFORM_QUEUE
      || typeKey === 'ContentReportNewInPlatformQueue'
    ) {
      return { kind: 'admin-moderation', reportId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_PENALTY_ISSUED
      || typeKey === 'ContentReportPenaltyIssued'
    ) {
      return { kind: 'settings-moderation' };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_ORG_SUSPENDED
      || typeKey === 'ContentReportOrganizationSuspended'
    ) {
      const orgId = reportData?.organizationId;
      if (orgId) return { kind: 'organization', organizationId: orgId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_FILED_AGAINST_YOU
      || typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_WARNING_ISSUED
      || typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_CONTENT_MODERATED
      || typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_ACCOUNT_SUSPENDED
      || typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_ORG_REMOVED
      || typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_AVATAR_RESET
      || typeKey === 'ContentReportFiledAgainstYou'
      || typeKey === 'ContentReportWarningIssued'
      || typeKey === 'ContentReportContentModerated'
      || typeKey === 'ContentReportAccountSuspended'
      || typeKey === 'ContentReportOrganizatorRemoved'
      || typeKey === 'ContentReportAvatarReset'
    ) {
      return { kind: 'reports-against-me', reportId };
    }
  }

  if (isNewInvitationNotification(n.type)) {
    return { kind: 'invitations' };
  }

  if (USER_PROFILE_TYPES.has(typeNum) && n.relatedAccountId) {
    return { kind: 'user', accountId: n.relatedAccountId };
  }

  if (EVENT_PAGE_TYPES.has(typeNum) || isEventPageNotificationType(n.type)) {
    const eventId = getNotificationEventId(n);
    if (eventId) return { kind: 'event', eventId };
  }

  const eventId = getNotificationEventId(n);
  if (eventId) return { kind: 'event', eventId };

  if (n.relatedAccountId) {
    return { kind: 'user', accountId: n.relatedAccountId };
  }

  return null;
}
