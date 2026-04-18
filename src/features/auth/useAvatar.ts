// features/auth/useAvatar.ts
// Хук для fileId аватара с двухуровневым кэшем:
// 1. Глобальный Map (пока жива вкладка)
// 2. Промисы in-flight — не шлём два одинаковых запроса

import { useState, useEffect } from 'react';
import { getAvatarFileId, getMyAvatarFileId } from '@/entities/user/avatarApi';

// null  = у пользователя нет аватара (подтверждено сервером)
// Map не содержит ключ = ещё не загружали
const cache: Map<string, string | null> = new Map();
const inFlight: Map<string, Promise<string | null>> = new Map();

function fetchAvatarId(accountId: string): Promise<string | null> {
  if (cache.has(accountId)) return Promise.resolve(cache.get(accountId) ?? null);

  if (!inFlight.has(accountId)) {
    const promise = getAvatarFileId(accountId).then(id => {
      cache.set(accountId, id);
      inFlight.delete(accountId);
      return id;
    }).catch(() => {
      // При ошибке не кэшируем — попробуем снова при следующем монтировании
      inFlight.delete(accountId);
      return null;
    });
    inFlight.set(accountId, promise);
  }

  return inFlight.get(accountId)!;
}

export function useAvatar(accountId: string | null | undefined): string | null {
  // Инициализируем из кэша только если ключ уже есть
  const [fileId, setFileId] = useState<string | null>(() =>
    accountId && cache.has(accountId) ? (cache.get(accountId) ?? null) : null
  );

  useEffect(() => {
    if (!accountId) return;
    fetchAvatarId(accountId).then(id => {
      setFileId(id);
    });
  }, [accountId]);

  return fileId;
}

export function useMyAvatar(): string | null {
  const [fileId, setFileId] = useState<string | null>(null);

  useEffect(() => {
    getMyAvatarFileId().then(setFileId);
  }, []);

  return fileId;
}

export function invalidateAvatarCache(accountId: string): void {
  cache.delete(accountId);
  inFlight.delete(accountId);
}
