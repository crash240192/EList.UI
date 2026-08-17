// entities/contentReport/types.ts — по swagger ContentReports

export const ReportTargetType = {
  Event: 'Event',
  Message: 'Message',
  Photo: 'Photo',
  Account: 'Account',
  Organization: 'Organization',
  EventOrganizator: 'EventOrganizator',
} as const;
export type ReportTargetTypeValue = (typeof ReportTargetType)[keyof typeof ReportTargetType];

export const ReportSeverity = {
  Community: 'Community',
  Safety: 'Safety',
} as const;
export type ReportSeverityValue = (typeof ReportSeverity)[keyof typeof ReportSeverity];

export const ReportStatus = {
  Open: 'Open',
  InReview: 'InReview',
  Resolved: 'Resolved',
  Dismissed: 'Dismissed',
  Escalated: 'Escalated',
} as const;
export type ReportStatusValue = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ReportTargetScope = {
  Event: 'Event',
  Message: 'Message',
  Photo: 'Photo',
  Account: 'Account',
  Organization: 'Organization',
  EventOrganizator: 'EventOrganizator',
  Both: 'Both',
  All: 'All',
} as const;
export type ReportTargetScopeValue = (typeof ReportTargetScope)[keyof typeof ReportTargetScope];

export const ReportQueue = {
  Organizers: 'Organizers',
  Platform: 'Platform',
  Both: 'Both',
} as const;
export type ReportQueueValue = (typeof ReportQueue)[keyof typeof ReportQueue];

export const ReportResolutionAction = {
  HideContent: 'HideContent',
  DeleteContent: 'DeleteContent',
  Warn: 'Warn',
  BanFromEvent: 'BanFromEvent',
  CancelEvent: 'CancelEvent',
  Dismiss: 'Dismiss',
  Escalate: 'Escalate',
  ResetAvatar: 'ResetAvatar',
  SuspendAccount: 'SuspendAccount',
  SuspendOrganization: 'SuspendOrganization',
  RemoveOrganizator: 'RemoveOrganizator',
  Other: 'Other',
} as const;
export type ReportResolutionActionValue =
  (typeof ReportResolutionAction)[keyof typeof ReportResolutionAction];

export const ReportActorContext = {
  Reporter: 'Reporter',
  Organizer: 'Organizer',
  PlatformModerator: 'PlatformModerator',
  System: 'System',
} as const;
export type ReportActorContextValue =
  (typeof ReportActorContext)[keyof typeof ReportActorContext];

export const REPORT_STATUS_LABELS: Record<ReportStatusValue, string> = {
  Open: 'Открыта',
  InReview: 'В работе',
  Resolved: 'Решена',
  Dismissed: 'Отклонена',
  Escalated: 'На площадке',
};

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetTypeValue, string> = {
  Event: 'Мероприятие',
  Message: 'Сообщение',
  Photo: 'Фото',
  Account: 'Профиль',
  Organization: 'Организация',
  EventOrganizator: 'Организатор',
};

export const REPORT_SEVERITY_LABELS: Record<ReportSeverityValue, string> = {
  Community: 'Нарушение правил',
  Safety: 'Серьёзное нарушение',
};

export const REPORT_TARGET_SCOPE_LABELS: Record<ReportTargetScopeValue, string> = {
  Event: 'Мероприятие',
  Message: 'Сообщение',
  Photo: 'Фото',
  Account: 'Профиль',
  Organization: 'Организация',
  EventOrganizator: 'Организатор',
  Both: 'Несколько типов',
  All: 'Все типы',
};

export const REPORT_QUEUE_LABELS: Record<ReportQueueValue, string> = {
  Organizers: 'Организаторы',
  Platform: 'Площадка',
  Both: 'Оба',
};

/** Действия resolve для организатора (без CancelEvent / Escalate / блокировок) */
export const ORGANIZER_RESOLUTION_ACTIONS = [
  ReportResolutionAction.HideContent,
  ReportResolutionAction.DeleteContent,
  ReportResolutionAction.Warn,
  ReportResolutionAction.BanFromEvent,
  ReportResolutionAction.ResetAvatar,
  ReportResolutionAction.Dismiss,
  ReportResolutionAction.Other,
] as const;

export const PLATFORM_RESOLUTION_ACTIONS = [
  ReportResolutionAction.HideContent,
  ReportResolutionAction.DeleteContent,
  ReportResolutionAction.Warn,
  ReportResolutionAction.BanFromEvent,
  ReportResolutionAction.CancelEvent,
  ReportResolutionAction.ResetAvatar,
  ReportResolutionAction.SuspendAccount,
  ReportResolutionAction.SuspendOrganization,
  ReportResolutionAction.RemoveOrganizator,
  ReportResolutionAction.Dismiss,
  ReportResolutionAction.Other,
] as const;

export const DESTRUCTIVE_RESOLUTION_ACTIONS = new Set<ReportResolutionActionValue>([
  ReportResolutionAction.HideContent,
  ReportResolutionAction.DeleteContent,
  ReportResolutionAction.BanFromEvent,
  ReportResolutionAction.CancelEvent,
  ReportResolutionAction.ResetAvatar,
  ReportResolutionAction.SuspendAccount,
  ReportResolutionAction.SuspendOrganization,
  ReportResolutionAction.RemoveOrganizator,
]);

export const REPORT_RESOLUTION_ACTION_LABELS: Record<ReportResolutionActionValue, string> = {
  HideContent: 'Скрыть',
  DeleteContent: 'Удалить',
  Warn: 'Предупреждение',
  BanFromEvent: 'Забанить на мероприятии',
  CancelEvent: 'Отменить мероприятие',
  Dismiss: 'Отклонить',
  Escalate: 'Передать на площадку',
  ResetAvatar: 'Сбросить обложку / аватар',
  SuspendAccount: 'Заблокировать аккаунт',
  SuspendOrganization: 'Заблокировать организацию',
  RemoveOrganizator: 'Снять организатора',
  Other: 'Другое',
};

export const REPORT_CREATE_TITLES: Record<ReportTargetTypeValue, string> = {
  Event: 'Жалоба на мероприятие',
  Message: 'Жалоба на сообщение',
  Photo: 'Жалоба на фото',
  Account: 'Жалоба на профиль',
  Organization: 'Жалоба на организацию',
  EventOrganizator: 'Жалоба на организатора',
};

export interface ParsedTargetSnapshot {
  type?: string;
  kind?: string;
  messageText?: string;
  messageId?: string;
  fileId?: string;
  albumId?: string;
  accountId?: string;
  organizationId?: string;
  eventId?: string;
  eventOrganizatorId?: string;
  login?: string;
  name?: string;
  description?: string;
  coverImageId?: string;
  avatarId?: string;
  active?: boolean;
  createDate?: string;
}

export function parseTargetSnapshot(raw: string | null | undefined): ParsedTargetSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ParsedTargetSnapshot;
  } catch {
    return null;
  }
}

export function snapshotPhotoKind(
  report: { targetSnapshot?: string | null },
): string {
  return parseTargetSnapshot(report.targetSnapshot)?.kind ?? '';
}

export function snapshotFileId(report: {
  targetType: ReportTargetTypeValue;
  targetId: string;
  fileId?: string | null;
  targetSnapshot?: string | null;
}): string | null {
  if (report.fileId) return report.fileId;
  const snap = parseTargetSnapshot(report.targetSnapshot);
  if (snap?.fileId) return snap.fileId;
  if (snap?.coverImageId) return snap.coverImageId;
  if (snap?.avatarId) return snap.avatarId;
  if (report.targetType === ReportTargetType.Photo) return report.targetId;
  return null;
}

export function snapshotPreviewText(report: {
  targetType: ReportTargetTypeValue;
  targetSnapshot?: string | null;
  eventName?: string | null;
}): string {
  const snap = parseTargetSnapshot(report.targetSnapshot);
  if (!snap) return report.targetSnapshot?.trim() || '';
  if (snap.messageText?.trim()) return snap.messageText.trim();
  if (snap.name?.trim()) return snap.name.trim();
  if (snap.login?.trim()) return `@${snap.login.trim()}`;
  if (snap.kind) return REPORT_PHOTO_KIND_LABELS[snap.kind] || snap.kind;
  if (report.eventName?.trim()) return report.eventName.trim();
  return '';
}

function uniqueActions(actions: ReportResolutionActionValue[]): ReportResolutionActionValue[] {
  return [...new Set(actions)];
}

export function organizerResolutionActionsFor(report: {
  targetType: ReportTargetTypeValue;
  eventId?: string | null;
  reportedAccountId?: string | null;
  targetSnapshot?: string | null;
}): ReportResolutionActionValue[] {
  const kind = snapshotPhotoKind(report);
  const snap = parseTargetSnapshot(report.targetSnapshot);
  const accountId = report.reportedAccountId || snap?.accountId || null;
  const actions: ReportResolutionActionValue[] = [
    ReportResolutionAction.Dismiss,
    ReportResolutionAction.Warn,
  ];
  if (
    report.targetType === ReportTargetType.Message
    || report.targetType === ReportTargetType.Photo
  ) {
    actions.push(ReportResolutionAction.HideContent, ReportResolutionAction.DeleteContent);
  }
  if (report.eventId && accountId) {
    actions.push(ReportResolutionAction.BanFromEvent);
  }
  if (report.targetType === ReportTargetType.Photo && kind === 'event_cover') {
    actions.push(ReportResolutionAction.ResetAvatar);
  }
  actions.push(ReportResolutionAction.Other);
  return uniqueActions(actions);
}

export function platformResolutionActionsFor(report: {
  targetType: ReportTargetTypeValue;
  eventId?: string | null;
  reportedAccountId?: string | null;
  organizationId?: string | null;
  targetSnapshot?: string | null;
}): ReportResolutionActionValue[] {
  const kind = snapshotPhotoKind(report);
  const snap = parseTargetSnapshot(report.targetSnapshot);
  const accountId = report.reportedAccountId || snap?.accountId || null;
  const organizationId = report.organizationId || snap?.organizationId || null;
  const actions: ReportResolutionActionValue[] = [
    ReportResolutionAction.Dismiss,
    ReportResolutionAction.Warn,
  ];
  if (
    report.targetType === ReportTargetType.Message
    || report.targetType === ReportTargetType.Photo
  ) {
    actions.push(ReportResolutionAction.HideContent, ReportResolutionAction.DeleteContent);
  }
  if (report.eventId && accountId) {
    actions.push(ReportResolutionAction.BanFromEvent);
  }
  if (report.eventId || report.targetType === ReportTargetType.Event) {
    actions.push(ReportResolutionAction.CancelEvent);
  }
  const resetAvatar =
    (report.targetType === ReportTargetType.Photo
      && (kind === 'account_avatar' || kind === 'organization_avatar' || kind === 'event_cover'))
    || report.targetType === ReportTargetType.Account
    || report.targetType === ReportTargetType.Organization;
  if (resetAvatar) {
    actions.push(ReportResolutionAction.ResetAvatar);
  }
  if (report.targetType === ReportTargetType.Account || accountId) {
    actions.push(ReportResolutionAction.SuspendAccount);
  }
  if (report.targetType === ReportTargetType.Organization || organizationId) {
    actions.push(ReportResolutionAction.SuspendOrganization);
  }
  if (report.targetType === ReportTargetType.EventOrganizator) {
    actions.push(ReportResolutionAction.RemoveOrganizator);
  }
  actions.push(ReportResolutionAction.Other);
  return uniqueActions(actions);
}

export function resolutionActionConfirm(action: ReportResolutionActionValue): {
  title: string;
  message: string;
  confirmLabel: string;
} | null {
  switch (action) {
    case ReportResolutionAction.HideContent:
      return { title: 'Скрыть контент?', message: 'Контент будет скрыт для пользователей.', confirmLabel: 'Скрыть' };
    case ReportResolutionAction.DeleteContent:
      return { title: 'Удалить контент?', message: 'Контент будет удалён без возможности восстановления.', confirmLabel: 'Удалить' };
    case ReportResolutionAction.BanFromEvent:
      return {
        title: 'Забанить на мероприятии?',
        message: 'Автор будет добавлен в чёрный список мероприятия.',
        confirmLabel: 'Забанить',
      };
    case ReportResolutionAction.CancelEvent:
      return {
        title: 'Отменить мероприятие?',
        message: 'Мероприятие будет отменено. Это действие доступно только модераторам площадки.',
        confirmLabel: 'Отменить мероприятие',
      };
    case ReportResolutionAction.ResetAvatar:
      return {
        title: 'Сбросить обложку / аватар?',
        message: 'Текущая обложка или аватарка будет убрана.',
        confirmLabel: 'Сбросить',
      };
    case ReportResolutionAction.SuspendAccount:
      return {
        title: 'Заблокировать аккаунт?',
        message: 'Аккаунт станет неактивным.',
        confirmLabel: 'Заблокировать',
      };
    case ReportResolutionAction.SuspendOrganization:
      return {
        title: 'Заблокировать организацию?',
        message: 'Организация станет неактивной.',
        confirmLabel: 'Заблокировать',
      };
    case ReportResolutionAction.RemoveOrganizator:
      return {
        title: 'Снять организатора?',
        message: 'Запись организатора будет удалена у мероприятия.',
        confirmLabel: 'Снять',
      };
    default:
      return null;
  }
}

export const REPORT_PHOTO_KIND_LABELS: Record<string, string> = {
  event_album: 'Фото альбома события',
  event_cover: 'Обложка события',
  account_album: 'Фото альбома профиля',
  account_avatar: 'Аватар профиля',
  organization_avatar: 'Аватар организации',
  album: 'Фото альбома',
};

export interface IReportReason {
  id: string;
  code: string;
  name: string;
  description: string;
  targetScope: ReportTargetScopeValue;
  severity: ReportSeverityValue;
  primaryQueue: ReportQueueValue;
  sortOrder: number;
  active: boolean;
  createDate: string;
}

export interface ICreateContentReportRequest {
  targetType: ReportTargetTypeValue;
  targetId: string;
  albumId?: string | null;
  reasonId: string;
  comment?: string | null;
}

export interface ICreateReportReasonRequest {
  code: string;
  name: string;
  description?: string | null;
  targetScope: ReportTargetScopeValue;
  severity: ReportSeverityValue;
  primaryQueue: ReportQueueValue;
  sortOrder: number;
}

export interface IUpdateReportReasonRequest {
  code: string;
  name: string;
  description?: string | null;
  targetScope: ReportTargetScopeValue;
  severity: ReportSeverityValue;
  primaryQueue: ReportQueueValue;
  sortOrder: number;
  active: boolean;
}

export interface IContentReportsSearchRequest {
  targetType?: ReportTargetTypeValue | null;
  targetId?: string | null;
  eventId?: string | null;
  messageId?: string | null;
  reasonId?: string | null;
  severity?: ReportSeverityValue | null;
  reporterAccountId?: string | null;
  reportedAccountId?: string | null;
  organizationId?: string | null;
  assignedTo?: string | null;
  status?: ReportStatusValue | null;
  organizerStatus?: ReportStatusValue | null;
  platformStatus?: ReportStatusValue | null;
  inPlatformQueue?: boolean | null;
  inOrganizerQueue?: boolean | null;
  onlyActive?: boolean | null;
  pageIndex?: number;
  pageSize?: number;
}

export interface IResolveContentReportRequest {
  resolutionAction: ReportResolutionActionValue;
  resolutionComment?: string | null;
  targetAccountId?: string | null;
}

export interface IEscalateContentReportRequest {
  comment?: string | null;
}

export interface IContentReportAction {
  id: string;
  reportId: string;
  actorAccountId: string;
  actorContext: ReportActorContextValue | string;
  action: string;
  details: string;
  createdAt: string;
}

export interface IContentReportAccount {
  id: string;
  login: string;
  avatarId: string | null;
}

export interface IContentReport {
  id: string;
  reporterAccountId: string;
  targetType: ReportTargetTypeValue;
  targetId: string;
  eventId: string | null;
  messageId: string | null;
  conversationId: string | null;
  organizationId: string | null;
  albumId: string | null;
  fileId: string | null;
  reportedAccountId: string | null;
  reasonId: string;
  comment: string | null;
  targetSnapshot: string | null;
  status: ReportStatusValue;
  organizerStatus: ReportStatusValue | null;
  platformStatus: ReportStatusValue | null;
  assignedTo: string | null;
  resolutionAction: ReportResolutionActionValue | null;
  resolutionComment: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reason: IReportReason | null;
  reporter: IContentReportAccount | null;
  assignedToAccount: IContentReportAccount | null;
  eventName: string | null;
  actions: IContentReportAction[];
}
