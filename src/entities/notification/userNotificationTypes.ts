// entities/notification/userNotificationTypes.ts
// Полный перечень UserNotificationType из swagger + русские подписи.
// Числовые коды известны только для уже используемых на фронте значений
// (явные значения C#-enum; порядок в swagger ≠ номерам).

import type { INotification } from './types';

/** Имена enum UserNotificationType (swagger) */
export const USER_NOTIFICATION_TYPE_NAMES = [
  'EventCreated',
  'EventUpdated',
  'EventCancelled',
  'EventFinished',
  'EventRestored',
  'NewSubscription',
  'Unsubscribed',
  'RelatedPersonSubscribed',
  'RelatedPersonUnsubscribed',
  'RelatedPersonActivityDigest',
  'Participated',
  'EventLeft',
  'RemovedFromEvent',
  'ParticipatedDigest',
  'EventLeftDigest',
  'MessageReplied',
  'NewMessage',
  'AddedToBlackList',
  'AddedToWhiteList',
  'RemovedFromBlackList',
  'RemovedFromWhiteList',
  'NotInWhiteList',
  'NewInvitation',
  'InvitationAccepted',
  'InvitationDeclined',
  'InvitationCancelled',
  'NewEventRating',
  'EventRatingChanged',
  'EventRatingDeleted',
  'EventRatingDigest',
  'ContentReportFiledAgainstYou',
  'ContentReportNewInOrganizerQueue',
  'ContentReportNewInPlatformQueue',
  'ContentReportWarningIssued',
  'ContentReportContentModerated',
  'ContentReportReviewed',
  'ContentReportAccountSuspended',
  'ContentReportOrganizationSuspended',
  'ContentReportOrganizatorRemoved',
  'ContentReportAvatarReset',
  'ContentReportPenaltyIssued',
  'OrganizationMemberAdded',
  'OrganizationMemberRemoved',
  'OrganizationMemberDeactivated',
  'OrganizationOwnershipTransferred',
  'OrganizationVerificationApproved',
  'OrganizationVerificationRejected',
  'EventOrganizatorAssigned',
  'EventOrganizatorRemoved',
  'AgreementUpdateRequired',
] as const;

export type UserNotificationTypeName = (typeof USER_NOTIFICATION_TYPE_NAMES)[number];

const NAME_SET = new Set<string>(USER_NOTIFICATION_TYPE_NAMES);

/** Известные числовые коды → имя (по текущему фронту / API) */
export const USER_NOTIFICATION_TYPE_BY_NUMBER: Record<number, UserNotificationTypeName> = {
  0: 'EventCreated',
  1: 'EventUpdated',
  2: 'EventCancelled',
  3: 'EventFinished',
  4: 'EventRestored',
  10: 'NewSubscription',
  11: 'Unsubscribed',
  12: 'RelatedPersonSubscribed',
  13: 'RelatedPersonUnsubscribed',
  20: 'Participated',
  21: 'EventLeft',
  31: 'MessageReplied',
  41: 'AddedToBlackList',
  42: 'AddedToWhiteList',
  43: 'RemovedFromBlackList',
  44: 'RemovedFromWhiteList',
  45: 'NotInWhiteList',
  51: 'NewInvitation',
  60: 'NewEventRating',
  61: 'EventRatingChanged',
  62: 'EventRatingDeleted',
  70: 'ContentReportFiledAgainstYou',
  71: 'ContentReportNewInOrganizerQueue',
  72: 'ContentReportNewInPlatformQueue',
  73: 'ContentReportWarningIssued',
  74: 'ContentReportContentModerated',
  75: 'ContentReportReviewed',
  76: 'ContentReportAccountSuspended',
  77: 'ContentReportOrganizationSuspended',
  78: 'ContentReportOrganizatorRemoved',
  79: 'ContentReportAvatarReset',
  80: 'ContentReportPenaltyIssued',
};

const LABELS: Record<UserNotificationTypeName, string> = {
  EventCreated: 'Создано событие',
  EventUpdated: 'Событие обновлено',
  EventCancelled: 'Событие отменено',
  EventFinished: 'Событие завершено',
  EventRestored: 'Событие восстановлено',
  NewSubscription: 'На вас подписались',
  Unsubscribed: 'От вас отписались',
  RelatedPersonSubscribed: 'Подписка у пользователя из ваших подписок',
  RelatedPersonUnsubscribed: 'Отписка у пользователя из ваших подписок',
  RelatedPersonActivityDigest: 'Активность в подписках',
  Participated: 'Участие в мероприятии',
  EventLeft: 'Выход из мероприятия',
  RemovedFromEvent: 'Удаление из мероприятия',
  ParticipatedDigest: 'Новые участники',
  EventLeftDigest: 'Участники вышли',
  MessageReplied: 'Новый ответ в обсуждении',
  NewMessage: 'Новое сообщение в обсуждении',
  AddedToBlackList: 'Добавлен в чёрный список',
  AddedToWhiteList: 'Добавлен в белый список',
  RemovedFromBlackList: 'Удалён из чёрного списка',
  RemovedFromWhiteList: 'Удалён из белого списка',
  NotInWhiteList: 'Нет в белом списке',
  NewInvitation: 'Новое приглашение',
  InvitationAccepted: 'Приглашение принято',
  InvitationDeclined: 'Приглашение отклонено',
  InvitationCancelled: 'Приглашение отменено',
  NewEventRating: 'Новая оценка мероприятия',
  EventRatingChanged: 'Оценка изменена',
  EventRatingDeleted: 'Оценка удалена',
  EventRatingDigest: 'Новые оценки мероприятия',
  ContentReportFiledAgainstYou: 'Жалоба на ваш контент',
  ContentReportNewInOrganizerQueue: 'Новая жалоба в мероприятии',
  ContentReportNewInPlatformQueue: 'Жалоба в очереди площадки',
  ContentReportWarningIssued: 'Предупреждение модерации',
  ContentReportContentModerated: 'Контент скрыт модерацией',
  ContentReportReviewed: 'Жалоба рассмотрена',
  ContentReportAccountSuspended: 'Аккаунт заблокирован',
  ContentReportOrganizationSuspended: 'Организация заблокирована',
  ContentReportOrganizatorRemoved: 'Снят с организаторов',
  ContentReportAvatarReset: 'Фото профиля сброшено',
  ContentReportPenaltyIssued: 'Назначено ограничение',
  OrganizationMemberAdded: 'Добавлен в организацию',
  OrganizationMemberRemoved: 'Удалён из организации',
  OrganizationMemberDeactivated: 'Участник организации деактивирован',
  OrganizationOwnershipTransferred: 'Передана роль владельца организации',
  OrganizationVerificationApproved: 'Организация верифицирована',
  OrganizationVerificationRejected: 'Верификация организации отклонена',
  EventOrganizatorAssigned: 'Назначен организатором мероприятия',
  EventOrganizatorRemoved: 'Снят с организаторов мероприятия',
  AgreementUpdateRequired: 'Требуется принять обновлённое соглашение',
};

/** Привести type из API (число / строка-число / имя enum) к имени swagger. */
export function resolveUserNotificationTypeName(
  type: INotification['type'] | undefined,
): UserNotificationTypeName | null {
  if (type == null || type === '') return null;
  if (typeof type === 'string') {
    if (NAME_SET.has(type)) return type as UserNotificationTypeName;
    const asNum = Number(type);
    if (Number.isFinite(asNum) && USER_NOTIFICATION_TYPE_BY_NUMBER[asNum]) {
      return USER_NOTIFICATION_TYPE_BY_NUMBER[asNum];
    }
    return null;
  }
  const n = Number(type);
  if (!Number.isFinite(n)) return null;
  return USER_NOTIFICATION_TYPE_BY_NUMBER[n] ?? null;
}

export function userNotificationTypeLabel(type: INotification['type']): string | null {
  const name = resolveUserNotificationTypeName(type);
  if (name) return LABELS[name];
  if (typeof type === 'string' && type.startsWith('ContentReport')) return 'Модерация';
  return null;
}

export function isUserNotificationTypeName(
  type: INotification['type'] | undefined,
  ...names: UserNotificationTypeName[]
): boolean {
  const resolved = resolveUserNotificationTypeName(type ?? null);
  if (!resolved) return false;
  return names.includes(resolved);
}

/** data → organizationId (org-уведомления) */
export function parseNotificationOrganizationId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const id = o.organizationId ?? o.OrganizationId ?? o.orgId ?? o.OrgId;
  if (id == null || id === '') return null;
  return String(id);
}
