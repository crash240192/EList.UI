// entities/contentReport/api.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';
import type {
  IContentReport,
  IContentReportAccount,
  IContentReportAction,
  IContentReportsSearchRequest,
  ICreateContentReportRequest,
  ICreateReportReasonRequest,
  IEscalateContentReportRequest,
  IReportReason,
  IResolveContentReportRequest,
  IUpdateReportReasonRequest,
  ReportActorContextValue,
  ReportQueueValue,
  ReportResolutionActionValue,
  ReportSeverityValue,
  ReportStatusValue,
  ReportTargetScopeValue,
  ReportTargetTypeValue,
} from './types';
import {
  ReportActorContext,
  ReportQueue,
  ReportResolutionAction,
  ReportSeverity,
  ReportStatus,
  ReportTargetScope,
  ReportTargetType,
} from './types';

type Raw = Record<string, unknown>;

type RawPagedList<T> = PagedList<T> & {
  Total?: number;
  Result?: T[];
  PageIndex?: number;
  PageSize?: number;
};

function pickStr(raw: Raw, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function pickNullableStr(raw: Raw, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = raw[key];
    if (v != null && v !== '') return String(v);
  }
  return null;
}

function normalizePagedList<T>(
  raw: RawPagedList<T> | null | undefined,
  pageIndex: number,
  pageSize: number,
): PagedList<T> {
  const items = raw?.result ?? raw?.Result ?? [];
  return {
    pageIndex: raw?.pageIndex ?? raw?.PageIndex ?? pageIndex,
    pageSize: raw?.pageSize ?? raw?.PageSize ?? pageSize,
    total: raw?.total ?? raw?.Total ?? items.length,
    result: items,
  };
}

function matchEnum<T extends string>(
  raw: unknown,
  values: readonly T[],
  fallback: T,
): T {
  const s = String(raw ?? '');
  if ((values as readonly string[]).includes(s)) return s as T;
  const lower = s.toLowerCase().replace(/_/g, '');
  for (const v of values) {
    if (v.toLowerCase() === lower) return v;
  }
  return fallback;
}

function normalizeTargetType(raw: unknown): ReportTargetTypeValue {
  return matchEnum(
    raw,
    Object.values(ReportTargetType),
    ReportTargetType.Event,
  );
}

function normalizeSeverity(raw: unknown): ReportSeverityValue {
  return matchEnum(
    raw,
    Object.values(ReportSeverity),
    ReportSeverity.Community,
  );
}

function normalizeStatus(raw: unknown): ReportStatusValue {
  return matchEnum(raw, Object.values(ReportStatus), ReportStatus.Open);
}

function normalizeNullableStatus(raw: unknown): ReportStatusValue | null {
  if (raw == null || raw === '') return null;
  return normalizeStatus(raw);
}

function normalizeTargetScope(raw: unknown): ReportTargetScopeValue {
  return matchEnum(
    raw,
    Object.values(ReportTargetScope),
    ReportTargetScope.Both,
  );
}

function normalizeQueue(raw: unknown): ReportQueueValue {
  return matchEnum(raw, Object.values(ReportQueue), ReportQueue.Organizers);
}

function normalizeResolutionAction(raw: unknown): ReportResolutionActionValue | null {
  if (raw == null || raw === '') return null;
  return matchEnum(
    raw,
    Object.values(ReportResolutionAction),
    ReportResolutionAction.Other,
  );
}

function normalizeActorContext(raw: unknown): ReportActorContextValue | string {
  const s = String(raw ?? '');
  if ((Object.values(ReportActorContext) as string[]).includes(s)) {
    return s as ReportActorContextValue;
  }
  return s || ReportActorContext.System;
}

export function normalizeReportReason(raw: unknown): IReportReason {
  const r = (raw ?? {}) as Raw;
  return {
    id: pickStr(r, 'id', 'Id'),
    code: pickStr(r, 'code', 'Code'),
    name: pickStr(r, 'name', 'Name'),
    description: pickStr(r, 'description', 'Description'),
    targetScope: normalizeTargetScope(r.targetScope ?? r.TargetScope),
    severity: normalizeSeverity(r.severity ?? r.Severity),
    primaryQueue: normalizeQueue(r.primaryQueue ?? r.PrimaryQueue),
    sortOrder: Number(r.sortOrder ?? r.SortOrder ?? 0),
    active: Boolean(r.active ?? r.Active ?? true),
    createDate: pickStr(r, 'createDate', 'CreateDate'),
  };
}

function normalizeAction(raw: unknown): IContentReportAction {
  const r = (raw ?? {}) as Raw;
  return {
    id: pickStr(r, 'id', 'Id'),
    reportId: pickStr(r, 'reportId', 'ReportId'),
    actorAccountId: pickStr(r, 'actorAccountId', 'ActorAccountId'),
    actorContext: normalizeActorContext(r.actorContext ?? r.ActorContext),
    action: pickStr(r, 'action', 'Action'),
    details: pickStr(r, 'details', 'Details'),
    createdAt: pickStr(r, 'createdAt', 'CreatedAt'),
  };
}

function normalizeAccount(raw: unknown): IContentReportAccount | null {
  if (!raw) return null;
  const r = raw as Raw;
  const avatar = r.avatarId ?? r.AvatarId;
  return {
    id: pickStr(r, 'id', 'Id'),
    login: pickStr(r, 'login', 'Login'),
    avatarId: avatar != null && avatar !== '' ? String(avatar) : null,
  };
}

export function normalizeContentReport(raw: unknown): IContentReport {
  const r = (raw ?? {}) as Raw;
  const reasonRaw = r.reason ?? r.Reason ?? null;
  const actionsRaw = (r.actions ?? r.Actions ?? []) as unknown[];
  return {
    id: pickStr(r, 'id', 'Id'),
    reporterAccountId: pickStr(r, 'reporterAccountId', 'ReporterAccountId'),
    targetType: normalizeTargetType(r.targetType ?? r.TargetType),
    targetId: pickStr(r, 'targetId', 'TargetId'),
    eventId: pickNullableStr(r, 'eventId', 'EventId'),
    messageId: pickNullableStr(r, 'messageId', 'MessageId'),
    conversationId: pickNullableStr(r, 'conversationId', 'ConversationId'),
    reasonId: pickStr(r, 'reasonId', 'ReasonId'),
    comment: pickNullableStr(r, 'comment', 'Comment'),
    targetSnapshot: pickNullableStr(r, 'targetSnapshot', 'TargetSnapshot'),
    status: normalizeStatus(r.status ?? r.Status),
    organizerStatus: normalizeNullableStatus(r.organizerStatus ?? r.OrganizerStatus),
    platformStatus: normalizeNullableStatus(r.platformStatus ?? r.PlatformStatus),
    assignedTo: pickNullableStr(r, 'assignedTo', 'AssignedTo'),
    resolutionAction: normalizeResolutionAction(r.resolutionAction ?? r.ResolutionAction),
    resolutionComment: pickNullableStr(r, 'resolutionComment', 'ResolutionComment'),
    resolvedBy: pickNullableStr(r, 'resolvedBy', 'ResolvedBy'),
    resolvedAt: pickNullableStr(r, 'resolvedAt', 'ResolvedAt'),
    createdAt: pickStr(r, 'createdAt', 'CreatedAt'),
    updatedAt: pickStr(r, 'updatedAt', 'UpdatedAt'),
    reason: reasonRaw ? normalizeReportReason(reasonRaw) : null,
    reporter: normalizeAccount(r.reporter ?? r.Reporter),
    assignedToAccount: normalizeAccount(r.assignedToAccount ?? r.AssignedToAccount),
    eventName: pickEventName(r.event ?? r.Event),
    actions: actionsRaw.map(normalizeAction),
  };
}

function pickEventName(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  return pickNullableStr(r, 'name', 'Name');
}

function sortReasons(list: IReportReason[]): IReportReason[] {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'ru');
  });
}

/** Сортировка очереди: Safety сверху, затем по дате (новые выше) */
export function sortReportsForQueue(list: IContentReport[]): IContentReport[] {
  return [...list].sort((a, b) => {
    const aSafety = a.reason?.severity === ReportSeverity.Safety ? 0 : 1;
    const bSafety = b.reason?.severity === ReportSeverity.Safety ? 0 : 1;
    if (aSafety !== bSafety) return aSafety - bSafety;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

// ---- Reasons ----

export async function fetchReportReasons(options?: {
  onlyActive?: boolean;
  forTargetType?: ReportTargetTypeValue | null;
  severity?: ReportSeverityValue | null;
}): Promise<IReportReason[]> {
  const params = new URLSearchParams();
  params.set('onlyActive', (options?.onlyActive ?? true) ? 'true' : 'false');
  if (options?.forTargetType) params.set('forTargetType', options.forTargetType);
  if (options?.severity) params.set('severity', options.severity);
  const data = await apiClient.get<unknown[]>(`/api/contentReports/reasons?${params}`);
  return sortReasons((data.result ?? []).map(normalizeReportReason));
}

export async function fetchReportReason(reasonId: string): Promise<IReportReason> {
  const data = await apiClient.get<unknown>(`/api/contentReports/reasons/${reasonId}`);
  return normalizeReportReason(data.result);
}

export async function createReportReason(
  payload: ICreateReportReasonRequest,
): Promise<string> {
  const data = await apiClient.post<string>('/api/contentReports/reasons/create', payload);
  return data.result;
}

export async function updateReportReason(
  reasonId: string,
  payload: IUpdateReportReasonRequest,
): Promise<void> {
  await apiClient.put(`/api/contentReports/reasons/update/${reasonId}`, payload);
}

export async function setReportReasonActive(
  reasonId: string,
  active: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/contentReports/reasons/setActive/${reasonId}?active=${active ? 'true' : 'false'}`,
  );
}

export async function deleteReportReason(reasonId: string): Promise<void> {
  await apiClient.delete(`/api/contentReports/reasons/delete/${reasonId}`);
}

// ---- Reports ----

export async function createContentReport(
  payload: ICreateContentReportRequest,
): Promise<string> {
  const body: Record<string, unknown> = {
    targetType: payload.targetType,
    targetId: payload.targetId,
    reasonId: payload.reasonId,
  };
  if (payload.comment?.trim()) body.comment = payload.comment.trim();
  const data = await apiClient.post<string>('/api/contentReports/create', body);
  return data.result;
}

export async function fetchContentReport(reportId: string): Promise<IContentReport> {
  const data = await apiClient.get<unknown>(`/api/contentReports/get/${reportId}`);
  return normalizeContentReport(data.result);
}

export async function fetchMyContentReports(
  pageIndex = 0,
  pageSize = 20,
): Promise<PagedList<IContentReport>> {
  const data = await apiClient.get<RawPagedList<unknown>>(
    `/api/contentReports/my?pageIndex=${pageIndex}&pageSize=${pageSize}`,
  );
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: page.result.map(normalizeContentReport),
  };
}

function buildSearchBody(payload: IContentReportsSearchRequest): Record<string, unknown> {
  const pageIndex = payload.pageIndex ?? 0;
  const pageSize = payload.pageSize ?? 20;
  const body: Record<string, unknown> = { pageIndex, pageSize };
  if (payload.targetType) body.targetType = payload.targetType;
  if (payload.targetId) body.targetId = payload.targetId;
  if (payload.eventId) body.eventId = payload.eventId;
  if (payload.messageId) body.messageId = payload.messageId;
  if (payload.reasonId) body.reasonId = payload.reasonId;
  if (payload.severity) body.severity = payload.severity;
  if (payload.reporterAccountId) body.reporterAccountId = payload.reporterAccountId;
  if (payload.assignedTo) body.assignedTo = payload.assignedTo;
  if (payload.status) body.status = payload.status;
  if (payload.organizerStatus) body.organizerStatus = payload.organizerStatus;
  if (payload.platformStatus) body.platformStatus = payload.platformStatus;
  if (payload.inPlatformQueue != null) body.inPlatformQueue = payload.inPlatformQueue;
  if (payload.inOrganizerQueue != null) body.inOrganizerQueue = payload.inOrganizerQueue;
  if (payload.onlyActive != null) body.onlyActive = payload.onlyActive;
  return body;
}

export async function searchPlatformContentReports(
  payload: IContentReportsSearchRequest = {},
): Promise<PagedList<IContentReport>> {
  const pageIndex = payload.pageIndex ?? 0;
  const pageSize = payload.pageSize ?? 20;
  const data = await apiClient.post<RawPagedList<unknown>>(
    '/api/contentReports/platform/search',
    buildSearchBody({ onlyActive: true, inPlatformQueue: true, ...payload }),
  );
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: sortReportsForQueue(page.result.map(normalizeContentReport)),
  };
}

export async function fetchPlatformContentReportsCount(
  onlyActive = true,
): Promise<number> {
  const data = await apiClient.get<number>(
    `/api/contentReports/platform/count?onlyActive=${onlyActive ? 'true' : 'false'}`,
  );
  return Number(data.result ?? 0);
}

export async function searchOrganizerContentReports(
  eventId: string,
  payload: IContentReportsSearchRequest = {},
): Promise<PagedList<IContentReport>> {
  const pageIndex = payload.pageIndex ?? 0;
  const pageSize = payload.pageSize ?? 20;
  const data = await apiClient.post<RawPagedList<unknown>>(
    `/api/contentReports/organizer/${eventId}/search`,
    buildSearchBody({ onlyActive: true, ...payload }),
  );
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: sortReportsForQueue(page.result.map(normalizeContentReport)),
  };
}

export async function fetchOrganizerContentReportsCount(
  eventId: string,
  onlyActive = true,
): Promise<number> {
  const data = await apiClient.get<number>(
    `/api/contentReports/organizer/${eventId}/count?onlyActive=${onlyActive ? 'true' : 'false'}`,
  );
  return Number(data.result ?? 0);
}

export async function takeContentReport(reportId: string): Promise<void> {
  await apiClient.post(`/api/contentReports/take/${reportId}`);
}

export async function resolveContentReport(
  reportId: string,
  payload: IResolveContentReportRequest,
): Promise<void> {
  const body: Record<string, unknown> = {
    resolutionAction: payload.resolutionAction,
  };
  if (payload.resolutionComment?.trim()) {
    body.resolutionComment = payload.resolutionComment.trim();
  }
  if (payload.targetAccountId) body.targetAccountId = payload.targetAccountId;
  await apiClient.post(`/api/contentReports/resolve/${reportId}`, body);
}

export async function escalateContentReport(
  reportId: string,
  payload: IEscalateContentReportRequest = {},
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (payload.comment?.trim()) body.comment = payload.comment.trim();
  await apiClient.post(`/api/contentReports/escalate/${reportId}`, body);
}

export async function fetchContentReportActions(
  reportId: string,
): Promise<IContentReportAction[]> {
  const data = await apiClient.get<unknown[]>(`/api/contentReports/actions/${reportId}`);
  return (data.result ?? []).map(normalizeAction);
}
