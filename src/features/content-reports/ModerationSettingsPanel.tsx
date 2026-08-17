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
      }),
    [reports],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Замечания модерации</h2>
        <p className={styles.hint}>
          Новые предупреждения и решения по вашему контенту приходят в{' '}
          <strong>уведомления</strong> (колокольчик в шапке). Здесь — история
          замечаний и итогов модерации.
        </p>
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
                to={`/reports-against-me?report=${report.id}`}
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
                {report.moderatorRemark && (
                  <p className={styles.remark}>{report.moderatorRemark}</p>
                )}
                {!report.moderatorRemark && report.resolutionAction && (
                  <p className={styles.remark}>
                    {actionSummary(report.resolutionAction)}
                  </p>
                )}
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

      <div className={styles.links}>
        <Link className={styles.link} to="/reports-against-me">
          Все входящие жалобы
        </Link>
        <Link className={styles.link} to="/my-reports">
          Мои исходящие жалобы
        </Link>
      </div>
    </div>
  );
}
