// entities/contentReport/types.ts — по swagger ContentReports

export const ReportTargetType = {
  Event: 'Event',
  Message: 'Message',
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
  Both: 'Both',
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
  Open: 'На рассмотрении',
  InReview: 'Рассматривается',
  Resolved: 'Решена',
  Dismissed: 'Отклонена',
  Escalated: 'Передана модераторам площадки',
};

export const REPORT_SEVERITY_LABELS: Record<ReportSeverityValue, string> = {
  Community: 'Нарушение правил',
  Safety: 'Серьёзное нарушение',
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

export interface IContentReport {
  id: string;
  reporterAccountId: string;
  targetType: ReportTargetTypeValue;
  targetId: string;
  eventId: string | null;
  messageId: string | null;
  conversationId: string | null;
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
  actions: IContentReportAction[];
}
