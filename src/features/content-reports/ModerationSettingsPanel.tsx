// features/content-reports/ModerationSettingsPanel.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MODERATION_PENALTY_TYPE_LABELS,
  fetchMyModerationPenalties,
  revokeModerationPenalty,
  type IModerationPenalty,
} from '@/entities/contentReport';
import {
  contentReportNotificationTypeLabel,
  isContentReportWarningIssued,
  parseContentReportNotificationData,
} from '@/entities/notification/contentReportNotification';
import { fetchMyNotifications } from '@/entities/notification/api';
import type { INotification } from '@/entities/notification/types';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { usePlatformRoleStore, useToastStore } from '@/app/store';
import { contentReportActionMessage } from './reportSubmitError';
import styles from './ModerationSettingsPanel.module.css';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function penaltyUntil(penalty: IModerationPenalty): string {
  if (!penalty.endsAt) return 'бессрочно';
  return `до ${formatDateTime(penalty.endsAt)}`;
}

function moderationSettingsListLink(path: '/reports-against-me' | '/my-reports'): string {
  return `${path}?from=settings-moderation`;
}

export function ModerationSettingsPanel() {
  const toast = useToastStore(s => s.add);
  const canRevoke = usePlatformRoleStore(s => s.hasPlatformAccess());
  const [warnings, setWarnings] = useState<INotification[]>([]);
  const [penalties, setPenalties] = useState<IModerationPenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [penaltiesLoading, setPenaltiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [penaltiesError, setPenaltiesError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const loadPenalties = useCallback(async () => {
    setPenaltiesLoading(true);
    setPenaltiesError(null);
    try {
      const list = await fetchMyModerationPenalties();
      setPenalties(list.filter(item => item.isActive));
    } catch (e) {
      setPenaltiesError(e instanceof Error ? e.message : 'Не удалось загрузить ограничения');
    } finally {
      setPenaltiesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchMyNotifications({
      pageIndex: 0,
      pageSize: 20,
      type: 'ContentReportWarningIssued',
    })
      .then(page => {
        if (cancelled) return;
        setWarnings(page.result.filter(item => isContentReportWarningIssued(item.type)));
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Не удалось загрузить');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void loadPenalties();
  }, [loadPenalties]);

  const notices = useMemo(
    () => warnings.map(notification => ({
      notification,
      reportData: parseContentReportNotificationData(notification.data),
    })),
    [warnings],
  );

  const handleRevoke = async () => {
    if (!revokeId || revokeBusy) return;
    setRevokeBusy(true);
    try {
      await revokeModerationPenalty(revokeId);
      toast('Ограничение снято', 'success');
      setRevokeId(null);
      await loadPenalties();
    } catch (e) {
      setPenaltiesError(contentReportActionMessage(e));
      setRevokeId(null);
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Замечания модерации</h2>
        <p className={styles.hint}>
          Здесь показываем предупреждения модераторов из общего инбокса
          и действующие ограничения аккаунта.
          Полная история входящих жалоб и решений доступна по ссылке ниже.
        </p>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ограничения</h3>
        {penaltiesLoading ? (
          <div className={styles.state}>Загрузка…</div>
        ) : penaltiesError ? (
          <div className={styles.error}>{penaltiesError}</div>
        ) : penalties.length === 0 ? (
          <div className={styles.state}>Действующих ограничений нет</div>
        ) : (
          <ul className={styles.list}>
            {penalties.map(penalty => (
              <li key={penalty.id} className={styles.penaltyCard}>
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>
                    {MODERATION_PENALTY_TYPE_LABELS[penalty.penaltyType] || penalty.penaltyType}
                  </span>
                  <span className={styles.status}>{penaltyUntil(penalty)}</span>
                </div>
                {penalty.reason && <p className={styles.remark}>{penalty.reason}</p>}
                <span className={styles.meta}>с {formatDateTime(penalty.startsAt)}</span>
                {canRevoke && (
                  <button
                    type="button"
                    className={styles.revokeBtn}
                    disabled={revokeBusy}
                    onClick={() => setRevokeId(penalty.id)}
                  >
                    Снять досрочно
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Предупреждения</h3>
        {loading ? (
          <div className={styles.state}>Загрузка…</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : notices.length === 0 ? (
          <div className={styles.state}>Предупреждений модераторов пока нет</div>
        ) : (
          <ul className={styles.list}>
            {notices.map(({ notification, reportData }) => {
              const reportId = reportData?.reportId;
              const href = reportId
                ? `/reports-against-me?report=${reportId}&from=settings-moderation`
                : '/reports-against-me?from=settings-moderation';
              return (
                <li key={notification.id}>
                  <Link className={styles.card} to={href}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>
                        {notification.title
                          || contentReportNotificationTypeLabel(notification.type)}
                      </span>
                      {!notification.readAt && <span className={styles.status}>Новое</span>}
                    </div>
                    <p className={styles.remark}>
                      {notification.message || 'Предупреждение по вашей жалобе'}
                    </p>
                    <span className={styles.meta}>
                      {reportData?.reasonName ? `${reportData.reasonName} · ` : ''}
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={styles.links}>
        <Link className={styles.link} to={moderationSettingsListLink('/reports-against-me')}>
          Все входящие жалобы
        </Link>
        <Link className={styles.link} to={moderationSettingsListLink('/my-reports')}>
          Мои исходящие жалобы
        </Link>
      </div>

      {revokeId && (
        <ConfirmDialog
          title="Снять ограничение?"
          message="Ограничение будет снято досрочно."
          confirmLabel={revokeBusy ? '…' : 'Снять'}
          cancelLabel="Назад"
          variant="accent"
          onConfirm={() => void handleRevoke()}
          onCancel={() => setRevokeId(null)}
        />
      )}
    </div>
  );
}
