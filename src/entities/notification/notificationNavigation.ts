// entities/notification/notificationNavigation.ts

import type { INotification } from './types';
import {
  getNotificationEventId,
  isEventPageNotificationType,
  isInvitationStatusNotification,
  isNewInvitationNotification,
  NOTIFICATION_TYPE_NEW_INVITATION,
} from './eventData';
import {
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
import {
  isUserNotificationTypeName,
  parseNotificationOrganizationId,
  resolveUserNotificationTypeName,
  userNotificationTypeLabel,
} from './userNotificationTypes';

export {
  NOTIFICATION_TYPE_NEW_INVITATION,
  isNewInvitationNotification,
  isInvitationStatusNotification,
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

const USER_PROFILE_TYPE_NAMES = new Set([
  'NewSubscription',
  'Unsubscribed',
  'RelatedPersonSubscribed',
  'RelatedPersonUnsubscribed',
  'RelatedPersonActivityDigest',
]);

export type NotificationNavTarget =
  | { kind: 'invitations' }
  | { kind: 'event'; eventId: string; conversationId?: string; messageId?: string }
  | { kind: 'user'; accountId: string }
  | { kind: 'my-reports'; reportId?: string }
  | { kind: 'reports-against-me'; reportId?: string }
  | { kind: 'admin-moderation'; reportId?: string }
  | { kind: 'event-reports'; eventId: string }
  | { kind: 'organization'; organizationId: string }
  | { kind: 'settings-organizations'; organizationId?: string }
  | { kind: 'settings-moderation' }
  | { kind: 'agreements-recheck' };

/** Message из payload уведомления MessageReplied (ответ) */
export function parseNotificationMessageRef(
  data: unknown,
): { id: string; conversationId?: string } | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const id = String(o.id ?? o.Id ?? '').trim();
  if (!id) return null;
  const conversationRaw = o.conversationId ?? o.ConversationId;
  const conversationId =
    conversationRaw == null || conversationRaw === ''
      ? undefined
      : String(conversationRaw);
  return { id, conversationId };
}

export function notificationTypeLabel(type: INotification['type']): string {
  const fromRegistry = userNotificationTypeLabel(type);
  if (fromRegistry) return fromRegistry;
  if (type == null) return 'Уведомление';
  return String(type);
}

/** Куда переходить по клику на уведомление */
export function getNotificationNavigationTarget(
  n: INotification,
): NotificationNavTarget | null {
  const typeNum = Number(n.type);
  const typeKey = notificationTypeKey(n.type);
  const typeName = resolveUserNotificationTypeName(n.type);
  const reportData = parseContentReportNotificationData(n.data);
  const reportId = reportData?.reportId ?? undefined;
  const orgIdFromData =
    parseNotificationOrganizationId(n.data)
    ?? reportData?.organizationId
    ?? null;

  if (isUserNotificationTypeName(n.type, 'AgreementUpdateRequired')) {
    return { kind: 'agreements-recheck' };
  }

  if (
    isUserNotificationTypeName(
      n.type,
      'OrganizationMemberAdded',
      'OrganizationMemberRemoved',
      'OrganizationMemberDeactivated',
      'OrganizationOwnershipTransferred',
      'OrganizationVerificationApproved',
      'OrganizationVerificationRejected',
    )
  ) {
    if (orgIdFromData) {
      return { kind: 'settings-organizations', organizationId: orgIdFromData };
    }
    return { kind: 'settings-organizations' };
  }

  if (isContentReportNotificationType(n.type)) {
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_REVIEWED
      || typeKey === 'ContentReportReviewed'
      || typeName === 'ContentReportReviewed'
    ) {
      return { kind: 'my-reports', reportId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_NEW_ORG_QUEUE
      || typeKey === 'ContentReportNewInOrganizerQueue'
      || typeName === 'ContentReportNewInOrganizerQueue'
    ) {
      const eventId = reportData?.eventId ?? n.eventId;
      if (eventId) return { kind: 'event-reports', eventId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_NEW_PLATFORM_QUEUE
      || typeKey === 'ContentReportNewInPlatformQueue'
      || typeName === 'ContentReportNewInPlatformQueue'
    ) {
      return { kind: 'admin-moderation', reportId };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_PENALTY_ISSUED
      || typeKey === 'ContentReportPenaltyIssued'
      || typeName === 'ContentReportPenaltyIssued'
    ) {
      return { kind: 'settings-moderation' };
    }
    if (
      typeNum === NOTIFICATION_TYPE_CONTENT_REPORT_ORG_SUSPENDED
      || typeKey === 'ContentReportOrganizationSuspended'
      || typeName === 'ContentReportOrganizationSuspended'
    ) {
      const orgId = reportData?.organizationId ?? orgIdFromData;
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

  if (isInvitationStatusNotification(n.type)) {
    return { kind: 'invitations' };
  }

  if (
    (typeName && USER_PROFILE_TYPE_NAMES.has(typeName))
    || typeNum === NOTIFICATION_TYPE_NEW_SUBSCRIPTION
    || typeNum === NOTIFICATION_TYPE_UNSUBSCRIBED
    || typeNum === NOTIFICATION_TYPE_RELATED_PERSON_SUBSCRIBED
    || typeNum === NOTIFICATION_TYPE_RELATED_PERSON_UNSUBSCRIBED
  ) {
    if (n.relatedAccountId) {
      return { kind: 'user', accountId: n.relatedAccountId };
    }
  }

  if (
    isUserNotificationTypeName(n.type, 'MessageReplied')
    || typeNum === 31
    || typeKey === 'MessageReplied'
  ) {
    const eventId = getNotificationEventId(n);
    const msg = parseNotificationMessageRef(n.data);
    if (eventId && msg?.id) {
      return {
        kind: 'event',
        eventId,
        conversationId: msg.conversationId,
        messageId: msg.id,
      };
    }
    if (eventId) return { kind: 'event', eventId };
  }

  if (
    isEventPageNotificationType(n.type)
    || typeNum === NOTIFICATION_TYPE_PARTICIPATED
    || typeNum === NOTIFICATION_TYPE_EVENT_LEFT
  ) {
    const eventId = getNotificationEventId(n);
    if (eventId) return { kind: 'event', eventId };
  }

  const eventId = getNotificationEventId(n);
  if (eventId) return { kind: 'event', eventId };

  if (orgIdFromData) {
    return { kind: 'organization', organizationId: orgIdFromData };
  }

  if (n.relatedAccountId) {
    return { kind: 'user', accountId: n.relatedAccountId };
  }

  return null;
}
