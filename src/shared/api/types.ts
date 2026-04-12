// ============================================================
// shared/api/types.ts
// Базовые типы ответов API, основанные на Swagger EList API
// ============================================================

/** Стандартная обёртка всех ответов API */
export interface CommandResult<T = void> {
  success: boolean;
  errorCode: number;
  message: string | null;
  stackTrace: string | null;
  result: T;
}

/** Пагинированный список */
export interface PagedList<T> {
  pageIndex: number;
  pageSize: number;
  total: number;
  result: T[];
}

export type Gender = 'Female' | 'Male';
