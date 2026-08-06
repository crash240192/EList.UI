// features/auth/useAvatar.ts
// Кэш fileId аватара по accountId. Источник — поле avatarId в данных аккаунта.
// Если avatarId неизвестен — один запрос GET /api/accounts/getData/{accountId}.
//
// Контракт avatarId:
//   string     — известный fileId (сеем в кэш)
//   undefined  — неизвестно → кэш или fetch
//   null / ''  — «в DTO пусто»; НЕ отравляем кэш как «нет аватара»,
//                потому что большинство call-site делают `avatarId ?? null`
//                и тем самым превращают «неизвестно» в «пусто».

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
      // Не кэшируем ошибку — при следующем маунте попробуем снова
      return null;
    });

  fetchInFlight.set(accountId, promise);
  return promise;
}

export function seedAvatarCache(accountId: string, avatarId: string | null): void {
  // Сеем только подтверждённый id; пустой null из «неизвестно» не пишем через этот хелпер
  // с call-site — только после успешного getData / явного set.
  cache.set(accountId, avatarId);
  notifyListeners(accountId, avatarId);
}

export function useAvatar(
  accountId: string | null | undefined,
  avatarId?: string | null,
): string | null {
  const knownId = typeof avatarId === 'string' && avatarId.trim() ? avatarId.trim() : null;

  const [fileId, setFileId] = useState<string | null>(() => {
    if (!accountId) return null;
    if (knownId) return knownId;
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

    // Есть явный fileId из DTO — используем и сеем кэш
    if (knownId) {
      cache.set(accountId, knownId);
      setFileId(knownId);
      return cleanup;
    }

    // null / undefined / '' — смотрим кэш, иначе fetch
    if (cache.has(accountId)) {
      setFileId(cache.get(accountId) ?? null);
      return cleanup;
    }

    setFileId(null);

    let cancelled = false;
    void resolveAvatarId(accountId).then(id => {
      if (!cancelled) setFileId(id);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [accountId, knownId]);

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
