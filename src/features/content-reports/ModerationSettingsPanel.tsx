// features/content-reports/ModerationSettingsPanel.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  ReportResolutionAction,
  ReportStatus,
  fetchReportsAgainstMe,
  subjectReportStatusLabel,
  type IContentReportSubjectView,
  type ReportResolutionActionValue,
} from '@/entities/contentReport';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import styles from './ModerationSettingsPanel.module.css';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function isModerationNotice(report: IContentReportSubjectView): boolean {
  if (report.moderatorRemark) return true;
  if (report.resolutionAction) return true;
  return (
    report.status === ReportStatus.Open
    || report.status === ReportStatus.InReview
    || report.status === ReportStatus.Escalated
  );
}

function noticePriority(report: IContentReportSubjectView): number {
  if (report.moderatorRemark) return 0;
  if (report.resolutionAction === ReportResolutionAction.Warn) return 1;
  if (
    report.resolutionAction === ReportResolutionAction.HideContent
    || report.resolutionAction === ReportResolutionAction.DeleteContent
    || report.resolutionAction === ReportResolutionAction.SuspendAccount
    || report.resolutionAction === ReportResolutionAction.SuspendOrganization
  ) {
    return 2;
  }
  if (
    report.status === ReportStatus.Open
    || report.status === ReportStatus.InReview
    || report.status === ReportStatus.Escalated
  ) {
    return 3;
  }
  return 4;
}

function actionSummary(action: ReportResolutionActionValue | null): string | null {
  if (!action) return null;
  return REPORT_RESOLUTION_ACTION_LABELS[action] ?? action;
}

function moderationListLink(path: '/reports-against-me' | '/my-reports'): string {
  return `${path}?from=settings-moderation`;
}

export function ModerationSettingsPanel() {
  const [reports, setReports] = useState<IContentReportSubjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchReportsAgainstMe(0, 30)
      .then(page => {
        if (cancelled) return;
        setReports(page.result);
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
    () => reports
      .filter(isModerationNotice)
      .sort((a, b) => {
        const byPriority = noticePriority(a) - noticePriority(b);
        if (byPriority !== 0) return byPriority;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 8),
    [reports],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Модерация</h2>
        <p className={styles.hint}>
          Новые предупреждения приходят в уведомления (колокольчик в шапке).
          Здесь — история замечаний и переходы к спискам жалоб.
        </p>
      </div>

      <div className={styles.hub}>
        <Link className={styles.hubCard} to={moderationListLink('/reports-against-me')}>
          <span className={styles.hubTitle}>Жалобы на меня</span>
          <span className={styles.hubText}>
            Входящие замечания и решения по вашему контенту
          </span>
        </Link>
        <Link className={styles.hubCard} to={moderationListLink('/my-reports')}>
          <span className={styles.hubTitle}>Мои жалобы</span>
          <span className={styles.hubText}>
            Исходящие жалобы и статус их рассмотрения
          </span>
        </Link>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Недавние замечания</h3>
          {!loading && notices.length > 0 && (
            <Link className={styles.sectionLink} to={moderationListLink('/reports-against-me')}>
              Все
            </Link>
          )}
        </div>

        {loading ? (
          <div className={styles.state}>Загрузка…</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : notices.length === 0 ? (
          <div className={styles.state}>Замечаний пока нет</div>
        ) : (
          <ul className={styles.list}>
            {notices.map(report => (
              <li key={report.id}>
                <Link
                  className={styles.card}
                  to={`/reports-against-me?report=${report.id}&from=settings-moderation`}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardTitle}>
                      {report.reason?.name
                        || REPORT_TARGET_TYPE_LABELS[report.targetType]
                        || 'Модерация'}
                    </span>
                    <span className={styles.status}>
                      {subjectReportStatusLabel(report.status, report.resolutionAction)}
                    </span>
                  </div>
                  {report.moderatorRemark ? (
                    <p className={styles.remark}>{report.moderatorRemark}</p>
                  ) : report.resolutionAction ? (
                    <p className={styles.remark}>
                      {actionSummary(report.resolutionAction)}
                    </p>
                  ) : null}
                  <span className={styles.meta}>
                    {REPORT_TARGET_TYPE_LABELS[report.targetType] || report.targetType}
                    {' · '}
                    {formatDateTime(report.resolvedAt ?? report.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
