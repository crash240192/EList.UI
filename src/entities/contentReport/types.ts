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
  ApplyPenalty: 'ApplyPenalty',
} as const;
export type ReportResolutionActionValue =
  (typeof ReportResolutionAction)[keyof typeof ReportResolutionAction];

export const ModerationPenaltyType = {
  SuspendAccount: 'SuspendAccount',
  SuspendOrganization: 'SuspendOrganization',
  BanEventCreate: 'BanEventCreate',
  BanEventParticipate: 'BanEventParticipate',
  BanMessaging: 'BanMessaging',
  BanOrganize: 'BanOrganize',
  BanFromEvent: 'BanFromEvent',
} as const;
export type ModerationPenaltyTypeValue =
  (typeof ModerationPenaltyType)[keyof typeof ModerationPenaltyType];

export const ORGANIZER_PENALTY_TYPES = [ModerationPenaltyType.BanFromEvent] as const;
export const PLATFORM_PENALTY_TYPES = [
  ModerationPenaltyType.BanFromEvent,
  ModerationPenaltyType.BanEventCreate,
  ModerationPenaltyType.BanEventParticipate,
  ModerationPenaltyType.BanMessaging,
  ModerationPenaltyType.BanOrganize,
  ModerationPenaltyType.SuspendAccount,
  ModerationPenaltyType.SuspendOrganization,
] as const;

export const PENALTY_DURATION_PRESETS = [
  { hours: 24, label: '24 часа' },
  { hours: 168, label: '7 дней' },
  { hours: 720, label: '30 дней' },
  { hours: 2160, label: '90 дней' },
] as const;

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
  ReportResolutionAction.ApplyPenalty,
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
  ReportResolutionAction.ApplyPenalty,
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
  ReportResolutionAction.ApplyPenalty,
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
  ApplyPenalty: 'Временное ограничение',
};

export const MODERATION_PENALTY_TYPE_LABELS: Record<ModerationPenaltyTypeValue, string> = {
  SuspendAccount: 'Блокировка аккаунта',
  SuspendOrganization: 'Блокировка организации',
  BanEventCreate: 'Запрет создавать мероприятия',
  BanEventParticipate: 'Запрет участвовать',
  BanMessaging: 'Запрет писать в чаты',
  BanOrganize: 'Запрет быть организатором',
  BanFromEvent: 'Бан на мероприятии',
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
    actions.push(ReportResolutionAction.BanFromEvent, ReportResolutionAction.ApplyPenalty);
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
  actions.push(ReportResolutionAction.ApplyPenalty, ReportResolutionAction.Other);
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
    case ReportResolutionAction.ApplyPenalty:
      return {
        title: 'Назначить ограничение?',
        message: 'Ограничение будет применено к выбранному аккаунту или организации.',
        confirmLabel: 'Назначить',
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
  penaltyType?: ModerationPenaltyTypeValue | null;
  durationHours?: number | null;
}

export interface IEscalateContentReportRequest {
  comment?: string | null;
}

export type ReportQueueKind = 'organizer' | 'platform';

export function reportQueueStatus(
  report: Pick<IContentReport, 'status' | 'organizerStatus' | 'platformStatus'>,
  queue: ReportQueueKind,
): ReportStatusValue {
  if (queue === 'organizer') return report.organizerStatus ?? report.status;
  return report.platformStatus ?? report.status;
}

export function canTakeReport(
  report: Pick<IContentReport, 'status' | 'organizerStatus' | 'platformStatus' | 'assignedTo'>,
  queue: ReportQueueKind,
  currentAccountId: string | null,
): boolean {
  const status = reportQueueStatus(report, queue);
  if (status === ReportStatus.Resolved || status === ReportStatus.Dismissed) return false;
  if (status === ReportStatus.Open) return true;
  if (status === ReportStatus.InReview && currentAccountId && report.assignedTo !== currentAccountId) {
    return true;
  }
  return false;
}

export function canResolveReport(
  report: Pick<IContentReport, 'status' | 'organizerStatus' | 'platformStatus' | 'assignedTo'>,
  queue: ReportQueueKind,
  currentAccountId: string | null,
): boolean {
  if (!currentAccountId) return false;
  return reportQueueStatus(report, queue) === ReportStatus.InReview
    && report.assignedTo === currentAccountId;
}

export function takeReportLabel(
  report: Pick<IContentReport, 'status' | 'organizerStatus' | 'platformStatus' | 'assignedTo'>,
  queue: ReportQueueKind,
  currentAccountId: string | null,
): string {
  const status = reportQueueStatus(report, queue);
  if (status === ReportStatus.InReview && currentAccountId && report.assignedTo !== currentAccountId) {
    return 'Перехватить';
  }
  return 'Взять в работу';
}

export function needsDurationHours(action: ReportResolutionActionValue): boolean {
  return (
    action === ReportResolutionAction.BanFromEvent
    || action === ReportResolutionAction.SuspendAccount
    || action === ReportResolutionAction.SuspendOrganization
    || action === ReportResolutionAction.ApplyPenalty
  );
}

export interface IModerationPenalty {
  id: string;
  accountId: string | null;
  organizationId: string | null;
  eventId: string | null;
  reportId: string | null;
  penaltyType: ModerationPenaltyTypeValue;
  reason: string | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  liftedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface IContentReportTargetStats {
  targetType: ReportTargetTypeValue;
  targetId: string;
  totalReports: number;
  openReports: number;
  resolvedReports: number;
  dismissedReports: number;
  warningCount: number;
  lastWarningAt: string | null;
  lastReportAt: string | null;
  relatedTotalReports: number;
  relatedOpenReports: number;
  relatedWarningCount: number;
  activePenalties: IModerationPenalty[];
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

/** Вид жалобы для адресата (GET /againstMe/{id}) — без данных жалобщика */
export interface IContentReportSubjectView {
  id: string;
  targetType: ReportTargetTypeValue;
  targetId: string;
  eventId: string | null;
  messageId: string | null;
  fileId: string | null;
  albumId: string | null;
  organizationId: string | null;
  eventOrganizatorId: string | null;
  targetSnapshot: string | null;
  reason: IReportReason | null;
  status: ReportStatusValue;
  resolutionAction: ReportResolutionActionValue | null;
  moderatorRemark: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Подписи для экрана «Жалобы на меня» — без упоминания жалобщика */
export function subjectReportStatusLabel(
  status: ReportStatusValue,
  resolutionAction: ReportResolutionActionValue | null,
): string {
  if (
    status === ReportStatus.Open
    || status === ReportStatus.InReview
    || status === ReportStatus.Escalated
  ) {
    return 'На рассмотрении';
  }
  if (status === ReportStatus.Dismissed) return 'Отклонено';
  if (resolutionAction === ReportResolutionAction.Warn) return 'Предупреждение';
  if (
    resolutionAction === ReportResolutionAction.HideContent
    || resolutionAction === ReportResolutionAction.DeleteContent
  ) {
    return 'Контент скрыт';
  }
  if (
    resolutionAction === ReportResolutionAction.SuspendAccount
    || resolutionAction === ReportResolutionAction.SuspendOrganization
  ) {
    return 'Блокировка';
  }
  if (resolutionAction === ReportResolutionAction.RemoveOrganizator) {
    return 'Снят с организаторов';
  }
  if (resolutionAction === ReportResolutionAction.ResetAvatar) {
    return 'Фото сброшено';
  }
  if (resolutionAction === ReportResolutionAction.CancelEvent) {
    return 'Мероприятие отменено';
  }
  if (resolutionAction === ReportResolutionAction.BanFromEvent) {
    return 'Ограничение на мероприятии';
  }
  if (resolutionAction === ReportResolutionAction.ApplyPenalty) {
    return 'Ограничение модерации';
  }
  if (status === ReportStatus.Resolved) return 'Решено';
  return REPORT_STATUS_LABELS[status] ?? status;
}

export function subjectViewForPreview(view: IContentReportSubjectView): IContentReport {
  return {
    id: view.id,
    reporterAccountId: '',
    targetType: view.targetType,
    targetId: view.targetId,
    eventId: view.eventId,
    messageId: view.messageId,
    conversationId: null,
    organizationId: view.organizationId,
    albumId: view.albumId,
    fileId: view.fileId,
    reportedAccountId: null,
    reasonId: view.reason?.id ?? '',
    comment: null,
    targetSnapshot: view.targetSnapshot,
    status: view.status,
    organizerStatus: null,
    platformStatus: null,
    assignedTo: null,
    resolutionAction: view.resolutionAction,
    resolutionComment: view.moderatorRemark,
    resolvedBy: null,
    resolvedAt: view.resolvedAt,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    reason: view.reason,
    reporter: null,
    assignedToAccount: null,
    eventName: null,
    actions: [],
  };
}
