// features/auth/useAccountId.ts
// Возвращает accountId текущего пользователя.
// При первом вызове делает запрос к API если id отсутствует в cookies.

import { useState, useEffect } from 'react';
import { getOrFetchAccountId } from '@/entities/user/api';
import { useAuthStore } from '@/app/store';

interface UseAccountIdResult {
  accountId: string | null;
  loading: boolean;
}

export function useAccountId(): UseAccountIdResult {
  const { isAuthenticated } = useAuthStore();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    getOrFetchAccountId()
      .then(setAccountId)
      .catch(() => setAccountId(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return { accountId, loading };
}
