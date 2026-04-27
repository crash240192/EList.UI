// features/auth/useAvatar.ts
// Хук для fileId аватара с двухуровневым кэшем:
// 1. Глобальный Map (пока жива вкладка)
// 2. Промисы in-flight — не шлём два одинаковых запроса

import { useState, useEffect, useCallback } from 'react';
import { getAvatarFileId, getMyAvatarFileId } from '@/entities/user/avatarApi';

// null  = у пользователя нет аватара (подтверждено сервером)
// Map не содержит ключ = ещё не загружали
const cache: Map<string, string | null> = new Map();
const inFlight: Map<string, Promise<string | null>> = new Map();
// Подписчики на обновление аватара
const listeners: Map<string, Set<(id: string | null) => void>> = new Map();

function fetchAvatarId(accountId: string, force = false): Promise<string | null> {
  if (!force && cache.has(accountId)) return Promise.resolve(cache.get(accountId) ?? null);

  if (!inFlight.has(accountId)) {
    const promise = getAvatarFileId(accountId).then(id => {
      cache.set(accountId, id);
      inFlight.delete(accountId);
      // Уведомляем всех подписчиков
      listeners.get(accountId)?.forEach(fn => fn(id));
      return id;
    }).catch(() => {
      inFlight.delete(accountId);
      return null;
    });
    inFlight.set(accountId, promise);
  }

  return inFlight.get(accountId)!;
}

export function useAvatar(accountId: string | null | undefined): string | null {
  const [fileId, setFileId] = useState<string | null>(() =>
    accountId && cache.has(accountId) ? (cache.get(accountId) ?? null) : null
  );

  useEffect(() => {
    if (!accountId) return;
    // Подписываемся на обновления
    if (!listeners.has(accountId)) listeners.set(accountId, new Set());
    listeners.get(accountId)!.add(setFileId);

    fetchAvatarId(accountId).then(id => setFileId(id));

    return () => { listeners.get(accountId)?.delete(setFileId); };
  }, [accountId]);

  return fileId;
}

export function useMyAvatar(): { fileId: string | null; refresh: () => void } {
  const [fileId, setFileId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getMyAvatarFileId().then(id => {
      setFileId(id);
      // Обновляем кэш чтобы useAvatar на других страницах тоже увидел
      if (id) {
        // Получаем accountId из localStorage/cookies чтобы инвалидировать
        const stored = localStorage.getItem('elist_account_id') ?? '';
        if (stored) {
          cache.set(stored, id);
          listeners.get(stored)?.forEach(fn => fn(id));
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { fileId, refresh };
}

export function invalidateAvatarCache(accountId: string): void {
  cache.delete(accountId);
  inFlight.delete(accountId);
}

/** Инвалидирует кэш и принудительно перезагружает аватар */
export function refreshAvatarCache(accountId: string): void {
  invalidateAvatarCache(accountId);
  fetchAvatarId(accountId, true);
}
