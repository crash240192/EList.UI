// entities/notification/notificationNavigation.ts

import type { INotification } from './types';
import {
  getNotificationEventId,
  isEventNotificationType,
  isNewInvitationNotification,
  NOTIFICATION_TYPE_NEW_INVITATION,
} from './eventData';

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
  | { kind: 'user'; accountId: string };

export function notificationTypeLabel(type: INotification['type']): string {
  if (type == null) return 'Уведомление';
  switch (Number(type)) {
    case 0: return 'Создано событие';
    case 1: return 'Событие обновлено';
    case 2: return 'Событие отменено';
    case 3: return 'Событие завершено';
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
    case NOTIFICATION_TYPE_NEW_INVITATION: return 'Новое приглашение';
    default: return String(type);
  }
}

/** Куда переходить по клику на уведомление */
export function getNotificationNavigationTarget(
  n: INotification,
): NotificationNavTarget | null {
  const typeNum = Number(n.type);

  if (isNewInvitationNotification(n.type)) {
    return { kind: 'invitations' };
  }

  if (USER_PROFILE_TYPES.has(typeNum) && n.relatedAccountId) {
    return { kind: 'user', accountId: n.relatedAccountId };
  }

  if (EVENT_PAGE_TYPES.has(typeNum) || isEventNotificationType(n.type)) {
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
