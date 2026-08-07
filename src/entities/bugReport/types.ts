// entities/bugReport/types.ts

export type BugReportStatus = 'Pending' | 'Resolved' | 'Cancelled';

export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  Pending: 'В ожидании',
  Resolved: 'Готово',
  Cancelled: 'Отменено',
};

export interface IBugReportCategory {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createDate: string;
}

export interface ICreateBugReportCategoryRequest {
  code: string;
  name: string;
  sortOrder: number;
}

export interface IUpdateBugReportCategoryRequest {
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface IBugReportReporter {
  id: string;
  active: boolean;
  login: string;
  avatarId: string | null;
}

export interface IBugReport {
  id: string;
  reporterAccountId: string;
  categoryId: string;
  description: string;
  status: BugReportStatus;
  createDate: string;
  updateDate: string;
  category: IBugReportCategory | null;
  reporter: IBugReportReporter | null;
  fileIds: string[];
}

export interface ICreateBugReportRequest {
  categoryId: string;
  description: string;
  fileIds: string[];
}

export interface IBugReportSearchRequest {
  categoryId?: string | null;
  status?: BugReportStatus | null;
  reporterAccountId?: string | null;
  description?: string | null;
  pageIndex?: number;
  pageSize?: number;
}
