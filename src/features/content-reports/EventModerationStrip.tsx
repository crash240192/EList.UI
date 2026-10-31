// features/content-reports/EventModerationStrip.tsx

import { useState } from 'react';
import { restoreModerationEvent } from '@/entities/contentReport';
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
  onRestored?: () => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

/** Баннер восстановления после отмены модерацией (статистика жалоб — в хиро-чипе). */
export function EventModerationStrip({
  eventId,
  isCancelled,
  cancelSource,
  cancelledAt,
  canRestore,
  onRestored,
}: EventModerationStripProps) {
  const toast = useToastStore(s => s.add);
  const [restoreComment, setRestoreComment] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moderationCancel = isCancelled && cancelSource === 'moderation';
  if (!moderationCancel) return null;

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
    } catch (e) {
      setError(contentReportActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.strip}>
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
