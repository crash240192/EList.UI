// features/content-reports/useEventTargetModerationStats.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReportTargetType,
  fetchContentReportTargetStats,
  type IContentReportTargetStats,
} from '@/entities/contentReport';

export function hasEventModerationSignal(stats: IContentReportTargetStats | null | undefined): boolean {
  if (!stats) return false;
  return Boolean(
    stats.openReports
    || stats.warningCount
    || stats.relatedOpenReports
    || stats.relatedWarningCount
    || stats.activePenalties.length > 0,
  );
}

export function eventModerationOpenCount(stats: IContentReportTargetStats | null | undefined): number {
  if (!stats) return 0;
  return (stats.openReports ?? 0) + (stats.relatedOpenReports ?? 0);
}

export function useEventTargetModerationStats(eventId: string | undefined, enabled: boolean) {
  const [stats, setStats] = useState<IContentReportTargetStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId || !enabled) {
      setStats(null);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchContentReportTargetStats(ReportTargetType.Event, eventId);
      setStats(next);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasSignal = useMemo(() => hasEventModerationSignal(stats), [stats]);
  const openCount = useMemo(() => eventModerationOpenCount(stats), [stats]);

  return { stats, loading, refresh, setStats, hasSignal, openCount };
}
