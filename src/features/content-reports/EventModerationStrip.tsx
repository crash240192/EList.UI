// features/content-reports/EventModerationStrip.tsx

import { useCallback, useEffect, useState } from 'react';
import {
  MODERATION_PENALTY_TYPE_LABELS,
  ReportTargetType,
  fetchContentReportTargetStats,
  restoreModerationEvent,
  revokeModerationPenalty,
  type IContentReportTargetStats,
  type IModerationPenalty,
} from '@/entities/contentReport';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { useToastStore } from '@/app/store';
import { contentReportActionMessage } from './reportSubmitError';
import styles from './EventModerationStrip.module.css';

interface EventModerationStripProps {
  eventId: string;
  isCancelled: boolean;
  cancelSource?: string | null;
  cancelledAt?: string | null;
  canRestore: boolean;
  canRevokePenalties: boolean;
  onRestored?: () => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

export function EventModerationStrip({
  eventId,
  isCancelled,
  cancelSource,
  cancelledAt,
  canRestore,
  canRevokePenalties,
  onRestored,
}: EventModerationStripProps) {
  const toast = useToastStore(s => s.add);
  const [stats, setStats] = useState<IContentReportTargetStats | null>(null);
  const [restoreComment, setRestoreComment] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const next = await fetchContentReportTargetStats(ReportTargetType.Event, eventId);
      setStats(next);
    } catch {
      setStats(null);
    }
  }, [eventId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setRestoreConfirm(false);
    try {
      await restoreModerationEvent(eventId, restoreComment.trim() || null);
      toast('Мероприятие восстановлено', 'success');
      setRestoreComment('');
      onRestored?.();
      await loadStats();
    } catch (e) {
      setError(contentReportActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (penalty: IModerationPenalty) => {
    if (busy || revokeBusyId) return;
    setRevokeBusyId(penalty.id);
    setError(null);
    try {
      await revokeModerationPenalty(penalty.id);
      toast('Ограничение снято', 'success');
      await loadStats();
    } catch (e) {
      setError(contentReportActionMessage(e));
    } finally {
      setRevokeBusyId(null);
    }
  };

  const moderationCancel = isCancelled && cancelSource === 'moderation';
  const hasStats = Boolean(
    stats
    && (stats.openReports
      || stats.warningCount
      || stats.relatedOpenReports
      || stats.relatedWarningCount
      || stats.activePenalties.length > 0),
  );

  if (!moderationCancel && !hasStats) return null;

  return (
    <div className={styles.strip}>
      {moderationCancel && (
        <div className={styles.restoreBanner}>
          <div>
            <div className={styles.restoreTitle}>Отменено модерацией</div>
            {cancelledAt && (
              <div className={styles.meta}>{formatDateTime(cancelledAt)}</div>
            )}
          </div>
          {canRestore && (
            <div className={styles.restoreActions}>
              <textarea
                className={styles.comment}
                value={restoreComment}
                onChange={e => setRestoreComment(e.target.value)}
                disabled={busy}
                rows={2}
                placeholder="Комментарий к восстановлению (необязательно)"
              />
              <button
                type="button"
                className={styles.restoreBtn}
                disabled={busy}
                onClick={() => setRestoreConfirm(true)}
              >
                {busy ? '…' : 'Восстановить'}
              </button>
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className={styles.stats}>
          жалоб на мероприятие: {stats.openReports}
          {' · '}предупреждений: {stats.warningCount}
          {' · '}по контенту: {stats.relatedOpenReports}
          {' · '}предупреждений по контенту: {stats.relatedWarningCount}
          {stats.activePenalties.length > 0
            ? ` · ограничений: ${stats.activePenalties.length}`
            : ''}
        </div>
      )}

      {stats && stats.activePenalties.length > 0 && (
        <div className={styles.penalties}>
          {stats.activePenalties.map(penalty => (
            <div key={penalty.id} className={styles.penaltyRow}>
              <span>
                {MODERATION_PENALTY_TYPE_LABELS[penalty.penaltyType] || penalty.penaltyType}
                {penalty.endsAt ? ` · до ${formatDateTime(penalty.endsAt)}` : ' · бессрочно'}
              </span>
              {canRevokePenalties && (
                <button
                  type="button"
                  className={styles.revokeBtn}
                  disabled={busy || revokeBusyId === penalty.id}
                  onClick={() => void handleRevoke(penalty)}
                >
                  {revokeBusyId === penalty.id ? '…' : 'Снять'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {restoreConfirm && (
        <ConfirmDialog
          title="Восстановить мероприятие?"
          message="Мероприятие снова станет активным. Участники получат уведомление."
          confirmLabel={busy ? '…' : 'Восстановить'}
          cancelLabel="Назад"
          variant="accent"
          onConfirm={() => void handleRestore()}
          onCancel={() => setRestoreConfirm(false)}
        />
      )}
    </div>
  );
}
