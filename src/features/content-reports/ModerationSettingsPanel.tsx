// features/content-reports/ModerationSettingsPanel.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  contentReportNotificationTypeLabel,
  isContentReportWarningIssued,
  parseContentReportNotificationData,
} from '@/entities/notification/contentReportNotification';
import { fetchMyNotifications } from '@/entities/notification/api';
import type { INotification } from '@/entities/notification/types';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import styles from './ModerationSettingsPanel.module.css';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function moderationSettingsListLink(path: '/reports-against-me' | '/my-reports'): string {
  return `${path}?from=settings-moderation`;
}

export function ModerationSettingsPanel() {
  const [warnings, setWarnings] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const notices = useMemo(
    () => warnings.map(notification => ({
      notification,
      reportData: parseContentReportNotificationData(notification.data),
    })),
    [warnings],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Замечания модерации</h2>
        <p className={styles.hint}>
          Здесь показываем предупреждения модераторов из общего инбокса.
          Полная история входящих жалоб и решений доступна по ссылке ниже.
        </p>
      </div>

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

      <div className={styles.links}>
        <Link className={styles.link} to={moderationSettingsListLink('/reports-against-me')}>
          Все входящие жалобы
        </Link>
        <Link className={styles.link} to={moderationSettingsListLink('/my-reports')}>
          Мои исходящие жалобы
        </Link>
      </div>
    </div>
  );
}
