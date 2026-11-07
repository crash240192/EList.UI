// features/content-reports/EventModerationDetailsModal.tsx

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MODERATION_PENALTY_TYPE_LABELS,
  revokeModerationPenalty,
  type IContentReportTargetStats,
  type IModerationPenalty,
} from '@/entities/contentReport';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { useToastStore } from '@/app/store';
import { contentReportActionMessage } from './reportSubmitError';
import styles from './EventModerationDetailsModal.module.css';

interface EventModerationDetailsModalProps {
  stats: IContentReportTargetStats;
  canRevokePenalties: boolean;
  canOpenReportsList: boolean;
  onOpenReportsList?: () => void;
  onClose: () => void;
  onChanged?: () => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

export function EventModerationDetailsModal({
  stats,
  canRevokePenalties,
  canOpenReportsList,
  onOpenReportsList,
  onClose,
  onChanged,
}: EventModerationDetailsModalProps) {
  useModalBackButton(onClose);
  const toast = useToastStore(s => s.add);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async (penalty: IModerationPenalty) => {
    if (revokeBusyId) return;
    setRevokeBusyId(penalty.id);
    setError(null);
    try {
      await revokeModerationPenalty(penalty.id);
      toast('Ограничение снято', 'success');
      onChanged?.();
    } catch (e) {
      setError(contentReportActionMessage(e));
    } finally {
      setRevokeBusyId(null);
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-moderation-details-title"
        onClick={e => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id="event-moderation-details-title" className={styles.title}>Жалобы и ограничения</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <ul className={styles.statsList}>
            <li>
              <span className={styles.statLabel}>Жалоб на мероприятие</span>
              <span className={styles.statValue}>{stats.openReports}</span>
            </li>
            <li>
              <span className={styles.statLabel}>Предупреждений</span>
              <span className={styles.statValue}>{stats.warningCount}</span>
            </li>
            <li>
              <span className={styles.statLabel}>Жалоб по контенту</span>
              <span className={styles.statValue}>{stats.relatedOpenReports}</span>
            </li>
            <li>
              <span className={styles.statLabel}>Предупреждений по контенту</span>
              <span className={styles.statValue}>{stats.relatedWarningCount}</span>
            </li>
            {stats.activePenalties.length > 0 && (
              <li>
                <span className={styles.statLabel}>Активных ограничений</span>
                <span className={styles.statValue}>{stats.activePenalties.length}</span>
              </li>
            )}
          </ul>

          {stats.activePenalties.length > 0 && (
            <div className={styles.penalties}>
              <div className={styles.sectionLabel}>Ограничения</div>
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
                      disabled={revokeBusyId === penalty.id}
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
        </div>

        <footer className={styles.foot}>
          {canOpenReportsList && onOpenReportsList && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                onOpenReportsList();
                onClose();
              }}
            >
              Открыть список жалоб
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Закрыть
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
