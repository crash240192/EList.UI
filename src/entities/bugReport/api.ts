// entities/bugReport/api.ts

import { apiClient } from '@/shared/api/client';
import type { PagedList } from '@/shared/api/types';
import type {
  BugReportStatus,
  IBugReport,
  IBugReportCategory,
  IBugReportReporter,
  IBugReportSearchRequest,
  ICreateBugReportCategoryRequest,
  ICreateBugReportRequest,
  IUpdateBugReportCategoryRequest,
} from './types';

type Raw = Record<string, unknown>;

type RawPagedList<T> = PagedList<T> & {
  Total?: number;
  Result?: T[];
  PageIndex?: number;
  PageSize?: number;
};

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

function pickStr(raw: Raw, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function normalizeCategory(raw: unknown): IBugReportCategory {
  const r = (raw ?? {}) as Raw;
  return {
    id: pickStr(r, 'id', 'Id'),
    code: pickStr(r, 'code', 'Code'),
    name: pickStr(r, 'name', 'Name'),
    active: Boolean(r.active ?? r.Active ?? true),
    sortOrder: Number(r.sortOrder ?? r.SortOrder ?? 0),
    createDate: pickStr(r, 'createDate', 'CreateDate'),
  };
}

function normalizeReporter(raw: unknown): IBugReportReporter | null {
  if (!raw) return null;
  const r = raw as Raw;
  const avatar = r.avatarId ?? r.AvatarId;
  return {
    id: pickStr(r, 'id', 'Id'),
    active: Boolean(r.active ?? r.Active ?? true),
    login: pickStr(r, 'login', 'Login'),
    avatarId: avatar != null && avatar !== '' ? String(avatar) : null,
  };
}

function normalizeStatus(raw: unknown): BugReportStatus {
  const s = String(raw ?? 'Pending');
  if (s === 'Resolved' || s === 'Cancelled' || s === 'Pending') return s;
  return 'Pending';
}

function normalizeReport(raw: unknown): IBugReport {
  const r = (raw ?? {}) as Raw;
  const fileIdsRaw = (r.fileIds ?? r.FileIds ?? []) as unknown[];
  const categoryRaw = r.category ?? r.Category ?? null;
  return {
    id: pickStr(r, 'id', 'Id'),
    reporterAccountId: pickStr(r, 'reporterAccountId', 'ReporterAccountId'),
    categoryId: pickStr(r, 'categoryId', 'CategoryId'),
    description: pickStr(r, 'description', 'Description'),
    status: normalizeStatus(r.status ?? r.Status),
    createDate: pickStr(r, 'createDate', 'CreateDate'),
    updateDate: pickStr(r, 'updateDate', 'UpdateDate'),
    category: categoryRaw ? normalizeCategory(categoryRaw) : null,
    reporter: normalizeReporter(r.reporter ?? r.Reporter),
    fileIds: fileIdsRaw.map(String).filter(Boolean),
  };
}

function sortCategories(list: IBugReportCategory[]): IBugReportCategory[] {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, 'ru');
  });
}

// ---- Categories ----

export async function fetchBugReportCategories(onlyActive = true): Promise<IBugReportCategory[]> {
  const data = await apiClient.get<unknown[]>(
    `/api/bugReports/categories?onlyActive=${onlyActive ? 'true' : 'false'}`,
  );
  return sortCategories((data.result ?? []).map(normalizeCategory));
}

export async function fetchBugReportCategory(categoryId: string): Promise<IBugReportCategory> {
  const data = await apiClient.get<unknown>(`/api/bugReports/categories/get/${categoryId}`);
  return normalizeCategory(data.result);
}

export async function createBugReportCategory(
  payload: ICreateBugReportCategoryRequest,
): Promise<string> {
  const data = await apiClient.post<string>('/api/bugReports/categories/create', payload);
  return data.result;
}

export async function updateBugReportCategory(
  categoryId: string,
  payload: IUpdateBugReportCategoryRequest,
): Promise<void> {
  await apiClient.put(`/api/bugReports/categories/update/${categoryId}`, payload);
}

export async function setBugReportCategoryActive(
  categoryId: string,
  active: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/bugReports/categories/setActive/${categoryId}?active=${active ? 'true' : 'false'}`,
  );
}

export async function deleteBugReportCategory(categoryId: string): Promise<void> {
  await apiClient.delete(`/api/bugReports/categories/delete/${categoryId}`);
}

// ---- Reports ----

export async function createBugReport(payload: ICreateBugReportRequest): Promise<string> {
  const data = await apiClient.post<string>('/api/bugReports/create', {
    categoryId: payload.categoryId,
    description: payload.description,
    fileIds: payload.fileIds,
  });
  return data.result;
}

export async function fetchBugReport(reportId: string): Promise<IBugReport> {
  const data = await apiClient.get<unknown>(`/api/bugReports/get/${reportId}`);
  return normalizeReport(data.result);
}

export async function fetchMyBugReports(
  pageIndex = 0,
  pageSize = 20,
): Promise<PagedList<IBugReport>> {
  const data = await apiClient.get<RawPagedList<unknown>>(
    `/api/bugReports/my?pageIndex=${pageIndex}&pageSize=${pageSize}`,
  );
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: page.result.map(normalizeReport),
  };
}

export async function searchBugReports(
  payload: IBugReportSearchRequest = {},
): Promise<PagedList<IBugReport>> {
  const pageIndex = payload.pageIndex ?? 0;
  const pageSize = payload.pageSize ?? 50;
  const body: Record<string, unknown> = {
    pageIndex,
    pageSize,
  };
  if (payload.categoryId) body.categoryId = payload.categoryId;
  if (payload.status) body.status = payload.status;
  if (payload.reporterAccountId) body.reporterAccountId = payload.reporterAccountId;
  if (payload.description) body.description = payload.description;

  const data = await apiClient.post<RawPagedList<unknown>>('/api/bugReports/search', body);
  const page = normalizePagedList(data.result, pageIndex, pageSize);
  return {
    ...page,
    result: page.result.map(normalizeReport),
  };
}

export async function updateBugReportStatus(
  reportId: string,
  status: BugReportStatus,
): Promise<void> {
  await apiClient.put(`/api/bugReports/status/${reportId}`, { status });
}
