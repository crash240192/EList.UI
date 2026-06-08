// features/auth/useAvatar.ts
// Кэш fileId аватара по accountId. Источник — поле avatarId в данных аккаунта,
// без отдельного запроса /api/media/account/avatar/{id}.

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/shared/api/client';
import { getOrFetchAccountId } from '@/entities/user/api';

// null = у пользователя нет аватара; отсутствие ключа = ещё не известно
const cache: Map<string, string | null> = new Map();
const listeners: Map<string, Set<(id: string | null) => void>> = new Map();

export function seedAvatarCache(accountId: string, avatarId: string | null): void {
  cache.set(accountId, avatarId);
  listeners.get(accountId)?.forEach(fn => fn(avatarId));
}

export function useAvatar(
  accountId: string | null | undefined,
  avatarId?: string | null,
): string | null {
  const [fileId, setFileId] = useState<string | null>(() => {
    if (!accountId) return null;
    if (avatarId !== undefined) return avatarId;
    return cache.has(accountId) ? (cache.get(accountId) ?? null) : null;
  });

  useEffect(() => {
    if (!accountId) return;

    if (!listeners.has(accountId)) listeners.set(accountId, new Set());
    listeners.get(accountId)!.add(setFileId);

    if (avatarId !== undefined) {
      cache.set(accountId, avatarId);
      setFileId(avatarId);
      return () => { listeners.get(accountId)?.delete(setFileId); };
    }

    if (cache.has(accountId)) {
      setFileId(cache.get(accountId) ?? null);
    }

    return () => { listeners.get(accountId)?.delete(setFileId); };
  }, [accountId, avatarId]);

  return fileId;
}

export function useMyAvatar(): { fileId: string | null; refresh: () => void } {
  const [fileId, setFileId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const accountId = await getOrFetchAccountId();
        const data = await apiClient.get<{ avatarId?: string | null }>('/api/accounts/getData');
        const avatarId = data.result?.avatarId ?? null;
        if (cancelled) return;
        setFileId(avatarId);
        seedAvatarCache(accountId, avatarId);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { fileId, refresh };
}

export function invalidateAvatarCache(accountId: string): void {
  cache.delete(accountId);
}
