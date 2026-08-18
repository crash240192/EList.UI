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
export const NOTIFICATION_TYPE_CONTENT_REPORT_PENALTY_ISSUED = 80;

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
  NOTIFICATION_TYPE_CONTENT_REPORT_PENALTY_ISSUED,
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
  'ContentReportPenaltyIssued',
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

function unwrapScalar(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) return unwrapScalar(value[0]);
    const firstUseful = value.find(item => unwrapScalar(item) != null);
    return unwrapScalar(firstUseful);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[]' || trimmed === '{}') return null;
    if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
      || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return unwrapScalar(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return value;
}

function pickStr(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = unwrapScalar(raw[key]);
    if (v == null || v === '') continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return null;
}

function pickEnum(raw: Record<string, unknown>, ...keys: string[]): string | number | null {
  for (const key of keys) {
    const v = unwrapScalar(raw[key]);
    if (v == null || v === '') continue;
    if (typeof v === 'string' || typeof v === 'number') return v;
  }
  return null;
}

export function parseContentReportNotificationData(data: unknown): IContentReportNotificationData | null {
  const unwrapped = unwrapScalar(data);
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) return null;
  const r = unwrapped as Record<string, unknown>;
  return {
    reportId: pickStr(r, 'reportId', 'ReportId'),
    targetType: pickEnum(r, 'targetType', 'TargetType'),
    targetId: pickStr(r, 'targetId', 'TargetId'),
    eventId: pickStr(r, 'eventId', 'EventId'),
    organizationId: pickStr(r, 'organizationId', 'OrganizationId'),
    resolutionAction: pickEnum(r, 'resolutionAction', 'ResolutionAction'),
    reasonName: pickStr(r, 'reasonName', 'ReasonName'),
    queue: pickStr(r, 'queue', 'Queue'),
  };
}

export function notificationTypeKey(type: INotification['type']): string {
  if (type == null) return '';
  if (typeof type === 'string') return type;
  return String(type);
}

export function isContentReportWarningIssued(type: INotification['type']): boolean {
  const key = notificationTypeKey(type);
  return key === 'ContentReportWarningIssued'
    || key === String(NOTIFICATION_TYPE_CONTENT_REPORT_WARNING_ISSUED);
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
    case '80':
    case 'ContentReportPenaltyIssued':
      return 'Назначено ограничение';
    default:
      return 'Модерация';
  }
}
