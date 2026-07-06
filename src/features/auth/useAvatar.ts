// features/auth/useAvatar.ts
// Кэш fileId аватара по accountId. Источник — поле avatarId в данных аккаунта.
// Если avatarId неизвестен — один запрос GET /api/accounts/getData/{accountId}.

import { useState, useEffect, useCallback } from 'react';
import { apiClient, isAuthenticated } from '@/shared/api/client';
import { fetchAccountById, getOrFetchAccountId } from '@/entities/user/api';
import { useAuthStore } from '@/app/store';

// null = у пользователя нет аватара; отсутствие ключа = ещё не известно
const cache: Map<string, string | null> = new Map();
const listeners: Map<string, Set<(id: string | null) => void>> = new Map();
const fetchInFlight = new Map<string, Promise<string | null>>();

function notifyListeners(accountId: string, avatarId: string | null): void {
  listeners.get(accountId)?.forEach(fn => fn(avatarId));
}

function resolveAvatarId(accountId: string): Promise<string | null> {
  if (cache.has(accountId)) return Promise.resolve(cache.get(accountId) ?? null);
  if (fetchInFlight.has(accountId)) return fetchInFlight.get(accountId)!;

  const promise = fetchAccountById(accountId)
    .then(data => {
      const id = data.avatarId ?? null;
      cache.set(accountId, id);
      notifyListeners(accountId, id);
      fetchInFlight.delete(accountId);
      return id;
    })
    .catch(() => {
      fetchInFlight.delete(accountId);
      return null;
    });

  fetchInFlight.set(accountId, promise);
  return promise;
}

function isExplicitlyEmpty(avatarId?: string | null): boolean {
  return avatarId === null || avatarId === '';
}

export function seedAvatarCache(accountId: string, avatarId: string | null): void {
  cache.set(accountId, avatarId);
  notifyListeners(accountId, avatarId);
}

export function useAvatar(
  accountId: string | null | undefined,
  avatarId?: string | null,
): string | null {
  const [fileId, setFileId] = useState<string | null>(() => {
    if (!accountId) return null;
    if (isExplicitlyEmpty(avatarId)) return null;
    if (avatarId) return avatarId;
    return cache.has(accountId) ? (cache.get(accountId) ?? null) : null;
  });

  useEffect(() => {
    if (!accountId) {
      setFileId(null);
      return;
    }

    if (!listeners.has(accountId)) listeners.set(accountId, new Set());
    listeners.get(accountId)!.add(setFileId);

    const cleanup = () => { listeners.get(accountId)?.delete(setFileId); };

    if (isExplicitlyEmpty(avatarId)) {
      cache.set(accountId, null);
      setFileId(null);
      return cleanup;
    }

    if (avatarId) {
      cache.set(accountId, avatarId);
      setFileId(avatarId);
      return cleanup;
    }

    // avatarId не передан — сбрасываем устаревший fileId от предыдущего accountId
    setFileId(cache.has(accountId) ? (cache.get(accountId) ?? null) : null);

    if (cache.has(accountId)) {
      return cleanup;
    }

    let cancelled = false;
    void resolveAvatarId(accountId).then(id => {
      if (!cancelled) setFileId(id);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [accountId, avatarId]);

  return fileId;
}

export function useMyAvatar(): { fileId: string | null; refresh: () => void } {
  const token = useAuthStore(s => s.token);
  const [fileId, setFileId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      setFileId(null);
      return;
    }

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
  }, [tick, token]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { fileId, refresh };
}

export function invalidateAvatarCache(accountId: string): void {
  cache.delete(accountId);
  notifyListeners(accountId, null);
}
