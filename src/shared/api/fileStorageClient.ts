// shared/api/fileStorageClient.ts
// Клиент для сервиса файлохранилища
// basePath: /elist/filestorage

import { getOrCreateClientHash, getAuthToken, notifyUnauthorized, getClientPlatform, getAppVersion, readCorrelationId, withCorrelationId } from './client';
import { shouldForceLogoutForApi } from '@/shared/auth/unauthorized';

const FILE_STORAGE_BASE = import.meta.env.VITE_FILE_STORAGE_URL ?? '/elist/filestorage';

export interface IUploadResult {
  id:  string;
  url: string;
}

export interface IFileMetadata {
  key: string;
  value: string;
}

export interface IFileInfo {
  id:          string;
  mimeType:    string;
  title:       string | null;
  description: string | null;
  url:         string;
  metadata?:   IFileMetadata[] | null;
}

/** Тело от download: «файл не найден»/заблокирован — не сброс сессии (раньше API отдавал Unauthorized). */
function isFileAccessBusinessError(message: string | null | undefined, errorCode?: number | null): boolean {
  if (errorCode === 404 || errorCode === 403) return true;
  const msg = (message ?? '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('отсутствует')
    || msg.includes('не найден')
    || msg.includes('заблокирован')
    || msg.includes('утерян')
  );
}

function handleFileStorageUnauthorized(
  status: number,
  body?: { message?: string | null; errorCode?: number | null },
): void {
  if (status !== 401) return;
  if (isFileAccessBusinessError(body?.message, body?.errorCode)) return;
  const hadAuthToken = Boolean(getAuthToken());
  if (shouldForceLogoutForApi('/api/filestorage', hadAuthToken)) {
    notifyUnauthorized();
  }
}

async function throwFileStorageError(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  let correlationId: string | null = null;
  let errorCode: number | null = null;
  try {
    const data = await res.json() as {
      message?: string | null;
      correlationId?: string | null;
      errorCode?: number | null;
    };
    correlationId = readCorrelationId(data, res);
    if (data.message?.trim()) message = data.message.trim();
    if (typeof data.errorCode === 'number') errorCode = data.errorCode;
    handleFileStorageUnauthorized(res.status, { message, errorCode });
  } catch {
    correlationId = readCorrelationId(null, res);
    handleFileStorageUnauthorized(res.status);
  }
  throw new Error(withCorrelationId(message, correlationId));
}

function authHeaders(): Record<string, string> {
  const clientHash = getOrCreateClientHash();
  const authToken  = getAuthToken();
  const headers: Record<string, string> = {
    'authorization-jwt': clientHash,
    'X-Client-Platform': getClientPlatform(),
    'X-App-Version': getAppVersion(),
  };
  if (authToken) headers['Authorization'] = authToken;
  return headers;
}

/**
 * POST /api/upload — загрузить файл, получить {id, url}
 * url строим сами через прокси — url из ответа содержит внутренний адрес сервера
 */
export async function uploadFile(file: File): Promise<IUploadResult> {
  const formData = new FormData();
  formData.append('formFile', file);

  const res = await fetch(`${FILE_STORAGE_BASE}/api/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    await throwFileStorageError(res, `Ошибка загрузки файла: ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(withCorrelationId(
      data.message ?? 'Ошибка загрузки файла',
      readCorrelationId(data, res),
    ));
  }

  const id = data.result.id as string;
  return {
    id,
    url: fileUrl(id), // строим через прокси, не берём url из ответа
  };
}

/**
 * POST /api/attachContext — добавить контекст (описание) к файлу
 */
export async function attachFileContext(fileId: string, context: string): Promise<void> {
  const res = await fetch(`${FILE_STORAGE_BASE}/api/attachContext?fileId=${fileId}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  if (!res.ok) {
    await throwFileStorageError(res, `Ошибка привязки контекста: ${res.status}`);
  }
}

/**
 * GET /api/info/{id} — метаданные файла
 */
export async function getFileInfo(fileId: string): Promise<IFileInfo | null> {
  try {
    const res = await fetch(`${FILE_STORAGE_BASE}/api/info/${fileId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = (data.result ?? data) as Record<string, unknown> | null;
    if (!raw) return null;
    const metaRaw = raw.metadata ?? raw.Metadata;
    const metadata = Array.isArray(metaRaw)
      ? metaRaw.map((item: Record<string, unknown>) => ({
          key: String(item.key ?? item.Key ?? ''),
          value: String(item.value ?? item.Value ?? ''),
        }))
      : null;
    return {
      id: String(raw.id ?? raw.Id ?? ''),
      mimeType: String(raw.mimeType ?? raw.MimeType ?? ''),
      title: (raw.title ?? raw.Title ?? null) as string | null,
      description: (raw.description ?? raw.Description ?? raw.context ?? raw.Context ?? null) as string | null,
      url: String(raw.url ?? raw.Url ?? ''),
      metadata,
    };
  } catch { return null; }
}

/**
 * Формирует URL для скачивания/отображения файла по ID
 */
export function fileUrl(fileId: string): string {
  return `${FILE_STORAGE_BASE}/api/download/${fileId}`;
}

/** URL из `fileUrl()` — обычный `<img src>` не может передать заголовки filestorage. */
export function isFileStorageDownloadUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const base = FILE_STORAGE_BASE.replace(/\/$/, '');
  return url.startsWith(`${base}/api/download/`)
    || url.includes('/elist/filestorage/api/download/');
}

/** Заголовки для GET /api/download/{fileId}: FullSize=true — оригинал; FullSize=false — превью. */
function downloadHeaders(options?: { fullSize?: boolean }): Record<string, string> {
  const h = { ...authHeaders() };
  if (options?.fullSize) {
    h.FullSize = 'true';
  } else {
    h.FullSize = 'false';
  }
  return h;
}

/**
 * Загружает файл с авторизационными заголовками и возвращает blob: URL
 * Используется для <img> которые требуют токен.
 * @param fullSize — иначе API отдаёт миниатюру (изображение/видео для превью).
 */
export async function fetchAuthedImage(
  fileId: string,
  options?: { fullSize?: boolean },
): Promise<string> {
  const res = await fetch(fileUrl(fileId), { headers: downloadHeaders(options) });
  if (!res.ok) {
    // Не разлогинивать при 401 с телом «файл отсутствует» (legacy download Unauthorized)
    let message = `Файл не найден: ${res.status}`;
    try {
      const data = await res.clone().json() as {
        message?: string | null;
        errorCode?: number | null;
      };
      if (data.message?.trim()) message = data.message.trim();
      handleFileStorageUnauthorized(res.status, {
        message: data.message,
        errorCode: data.errorCode,
      });
    } catch {
      handleFileStorageUnauthorized(res.status);
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
