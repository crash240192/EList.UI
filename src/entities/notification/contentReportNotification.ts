// entities/notification/contentReportNotification.ts

import type { INotification } from './types';

export const NOTIFICATION_TYPE_CONTENT_REPORT_FILED_AGAINST_YOU = 70;
export const NOTIFICATION_TYPE_CONTENT_REPORT_NEW_ORG_QUEUE = 71;
export const NOTIFICATION_TYPE_CONTENT_REPORT_NEW_PLATFORM_QUEUE = 72;
export const NOTIFICATION_TYPE_CONTENT_REPORT_WARNING_ISSUED = 73;
export const NOTIFICATION_TYPE_CONTENT_REPORT_CONTENT_MODERATED = 74;
export const NOTIFICATION_TYPE_CONTENT_REPORT_REVIEWED = 75;
export const NOTIFICATION_TYPE_CONTENT_REPORT_ACCOUNT_SUSPENDED = 76;
export const NOTIFICATION_TYPE_CONTENT_REPORT_ORG_SUSPENDED = 77;
export const NOTIFICATION_TYPE_CONTENT_REPORT_ORG_REMOVED = 78;
export const NOTIFICATION_TYPE_CONTENT_REPORT_AVATAR_RESET = 79;

const CONTENT_REPORT_TYPE_NUMBERS = new Set([
  NOTIFICATION_TYPE_CONTENT_REPORT_FILED_AGAINST_YOU,
  NOTIFICATION_TYPE_CONTENT_REPORT_NEW_ORG_QUEUE,
  NOTIFICATION_TYPE_CONTENT_REPORT_NEW_PLATFORM_QUEUE,
  NOTIFICATION_TYPE_CONTENT_REPORT_WARNING_ISSUED,
  NOTIFICATION_TYPE_CONTENT_REPORT_CONTENT_MODERATED,
  NOTIFICATION_TYPE_CONTENT_REPORT_REVIEWED,
  NOTIFICATION_TYPE_CONTENT_REPORT_ACCOUNT_SUSPENDED,
  NOTIFICATION_TYPE_CONTENT_REPORT_ORG_SUSPENDED,
  NOTIFICATION_TYPE_CONTENT_REPORT_ORG_REMOVED,
  NOTIFICATION_TYPE_CONTENT_REPORT_AVATAR_RESET,
]);

const CONTENT_REPORT_TYPE_NAMES = new Set([
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
]);

export interface IContentReportNotificationData {
  reportId: string | null;
  targetType: string | number | null;
  targetId: string | null;
  eventId: string | null;
  organizationId: string | null;
  resolutionAction: string | number | null;
  reasonName: string | null;
  queue: string | null;
}

function pickStr(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (v != null && v !== '') return String(v);
  }
  return null;
}

export function parseContentReportNotificationData(data: unknown): IContentReportNotificationData | null {
  if (!data || typeof data !== 'object') return null;
  const r = data as Record<string, unknown>;
  return {
    reportId: pickStr(r, 'reportId', 'ReportId'),
    targetType: (() => {
      const v = r.targetType ?? r.TargetType;
      if (v == null) return null;
      if (typeof v === 'string' || typeof v === 'number') return v;
      return String(v);
    })(),
    targetId: pickStr(r, 'targetId', 'TargetId'),
    eventId: pickStr(r, 'eventId', 'EventId'),
    organizationId: pickStr(r, 'organizationId', 'OrganizationId'),
    resolutionAction: (() => {
      const v = r.resolutionAction ?? r.ResolutionAction;
      if (v == null) return null;
      if (typeof v === 'string' || typeof v === 'number') return v;
      return String(v);
    })(),
    reasonName: pickStr(r, 'reasonName', 'ReasonName'),
    queue: pickStr(r, 'queue', 'Queue'),
  };
}

export function notificationTypeKey(type: INotification['type']): string {
  if (type == null) return '';
  if (typeof type === 'string') return type;
  return String(type);
}

export function isContentReportNotificationType(type: INotification['type']): boolean {
  if (type == null) return false;
  if (typeof type === 'string') {
    return CONTENT_REPORT_TYPE_NAMES.has(type) || type.startsWith('ContentReport');
  }
  const n = Number(type);
  return Number.isFinite(n) && CONTENT_REPORT_TYPE_NUMBERS.has(n);
}

export function contentReportNotificationTypeLabel(type: INotification['type']): string {
  const key = notificationTypeKey(type);
  switch (key) {
    case '70':
    case 'ContentReportFiledAgainstYou':
      return 'Жалоба на ваш контент';
    case '71':
    case 'ContentReportNewInOrganizerQueue':
      return 'Новая жалоба в мероприятии';
    case '72':
    case 'ContentReportNewInPlatformQueue':
      return 'Жалоба в очереди площадки';
    case '73':
    case 'ContentReportWarningIssued':
      return 'Предупреждение модерации';
    case '74':
    case 'ContentReportContentModerated':
      return 'Контент скрыт модерацией';
    case '75':
    case 'ContentReportReviewed':
      return 'Жалоба рассмотрена';
    case '76':
    case 'ContentReportAccountSuspended':
      return 'Аккаунт заблокирован';
    case '77':
    case 'ContentReportOrganizationSuspended':
      return 'Организация заблокирована';
    case '78':
    case 'ContentReportOrganizatorRemoved':
      return 'Снят с организаторов';
    case '79':
    case 'ContentReportAvatarReset':
      return 'Фото профиля сброшено';
    default:
      return 'Модерация';
  }
}
