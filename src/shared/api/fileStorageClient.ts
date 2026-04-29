// shared/api/fileStorageClient.ts
// Клиент для сервиса файлохранилища
// basePath: /elist/filestorage

import { getOrCreateClientHash, getAuthToken } from './client';

const FILE_STORAGE_BASE = import.meta.env.VITE_FILE_STORAGE_URL ?? '/elist/filestorage';

export interface IUploadResult {
  id:  string;
  url: string;
}

export interface IFileInfo {
  id:          string;
  mimeType:    string;
  title:       string | null;
  description: string | null;
  url:         string;
}

function authHeaders(): Record<string, string> {
  const clientHash = getOrCreateClientHash();
  const authToken  = getAuthToken();
  const headers: Record<string, string> = {
    'authorization-jwt': clientHash,
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

  if (!res.ok) throw new Error(`Ошибка загрузки файла: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? 'Ошибка загрузки файла');

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
  if (!res.ok) throw new Error(`Ошибка привязки контекста: ${res.status}`);
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
    return data.result ?? null;
  } catch { return null; }
}

/**
 * Формирует URL для скачивания/отображения файла по ID
 */
export function fileUrl(fileId: string): string {
  return `${FILE_STORAGE_BASE}/api/download/${fileId}`;
}

/**
 * Загружает файл с авторизационными заголовками и возвращает blob: URL
 * Используется для <img> которые требуют токен
 */
export async function fetchAuthedImage(fileId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000); // 15 сек таймаут
  try {
    const res = await fetch(fileUrl(fileId), { headers: authHeaders(), signal: controller.signal });
    if (!res.ok) throw new Error(`Файл не найден: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timer);
  }
}
