// features/content-reports/useOrganizerReportsCount.ts

import { useCallback, useEffect, useState } from 'react';
import { fetchOrganizerContentReportsCount } from '@/entities/contentReport';

export function useOrganizerReportsCount(eventId: string | undefined, enabled: boolean) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId || !enabled) {
      setCount(0);
      return;
    }
    setLoading(true);
    try {
      const n = await fetchOrganizerContentReportsCount(eventId, true);
      setCount(Number.isFinite(n) ? n : 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { count, loading, refresh, setCount };
}
