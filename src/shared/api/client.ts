// shared/api/client.ts
// HTTP-клиент EList API
//
// Схема авторизации — два заголовка:
//   authorization-jwt : рандомный клиентский хеш, генерируется при первом визите,
//                       хранится в cookies, передаётся в КАЖДОМ запросе
//   Authorization     : "N3 {token}" — GUID-токен после логина,
//                       хранится в cookies, передаётся в запросах требующих аутентификации

import { cookies } from '@/shared/lib/cookies';
import type { CommandResult } from './types';

// ---- Ключи cookies ----

export const COOKIE_CLIENT_HASH = 'elist_client_hash';
export const COOKIE_AUTH_TOKEN  = 'elist_auth_token';

// В dev-режиме используем относительный путь → Vite проксирует → нет CORS OPTIONS
// В production VITE_API_BASE_URL должна быть полным URL
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/eList';

// ---- Ошибки ----

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly serverMessage: string | null = null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Клиентский хеш (authorization-jwt) ----

function generateClientHash(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getOrCreateClientHash(): string {
  let hash = cookies.get(COOKIE_CLIENT_HASH);
  if (!hash) {
    hash = generateClientHash();
    cookies.set(COOKIE_CLIENT_HASH, hash, 3650);
  }
  return hash;
}

// ---- Auth token ----

export function getAuthToken(): string | null {
  return cookies.get(COOKIE_AUTH_TOKEN);
}

export function setAuthToken(token: string): void {
  cookies.set(COOKIE_AUTH_TOKEN, token, 30);
}

export function clearAuthToken(): void {
  cookies.delete(COOKIE_AUTH_TOKEN);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// ---- 401 handler (устанавливается из роутера) ----

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

// ---- Основной запрос ----

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<CommandResult<T>> {
  const clientHash = getOrCreateClientHash();
  const authToken  = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization-jwt': clientHash,
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = authToken;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearAuthToken();
    onUnauthorized?.();
    throw new ApiError(401, 'Необходима авторизация');
  }

  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
  }

  const data: CommandResult<T> = await response.json();

  if (!data.success) {
    throw new ApiError(data.errorCode ?? 0, data.message ?? 'Ошибка API', data.message);
  }

  return data;
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
};
