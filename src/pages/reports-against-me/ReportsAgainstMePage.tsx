// pages/reports-against-me/ReportsAgainstMePage.tsx

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  ReportResolutionAction,
  ReportStatus,
  fetchReportAgainstMe,
  fetchReportsAgainstMe,
  subjectReportStatusLabel,
  subjectViewForPreview,
  type IContentReportSubjectView,
  type ReportResolutionActionValue,
  type ReportStatusValue,
} from '@/entities/contentReport';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { usePageTitle } from '@/shared/hooks';
import { ReportTargetPreview } from '@/features/content-reports';
import styles from './ReportsAgainstMePage.module.css';

const PAGE_SIZE = 20;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function statusChipClass(
  status: ReportStatusValue,
  action: ReportResolutionActionValue | null,
): string {
  if (status === ReportStatus.Dismissed) return styles.statusDismissed;
  if (action === ReportResolutionAction.Warn) return styles.statusWarn;
  if (
    action === ReportResolutionAction.HideContent
    || action === ReportResolutionAction.DeleteContent
  ) {
    return styles.statusHidden;
  }
  if (
    status === ReportStatus.Open
    || status === ReportStatus.InReview
    || status === ReportStatus.Escalated
  ) {
    return styles.statusReview;
  }
  if (status === ReportStatus.Resolved) return styles.statusResolved;
  return styles.statusReview;
}

export default function ReportsAgainstMePage() {
  usePageTitle('Жалобы на меня');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialReportId = searchParams.get('report');

  const [reports, setReports] = useState<IContentReportSubjectView[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId);
  const [detail, setDetail] = useState<IContentReportSubjectView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadPage = useCallback(async (index: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await fetchReportsAgainstMe(index, PAGE_SIZE);
      setTotal(page.total);
      setPageIndex(index);
      setReports(prev => append ? [...prev, ...page.result] : page.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить список');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  useEffect(() => {
    if (initialReportId) setSelectedId(initialReportId);
  }, [initialReportId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      if (searchParams.has('report')) {
        const next = new URLSearchParams(searchParams);
        next.delete('report');
        setSearchParams(next, { replace: true });
      }
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchReportAgainstMe(selectedId)
      .then(report => {
        if (cancelled) return;
        setDetail(report);
      })
      .catch(e => {
        if (cancelled) return;
        setDetailError(e instanceof Error ? e.message : 'Не удалось загрузить');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedId, searchParams, setSearchParams]);

  const hasMore = reports.length < total;

  const openDetail = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('report', id);
    setSearchParams(next, { replace: true });
  };

  const closeDetail = () => setSelectedId(null);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.cardTitle}>Жалобы на меня</h1>
          <p className={styles.subtitle}>
            Замечания модерации по вашему контенту. Кто пожаловался — не показываем.
          </p>
        </div>
        <div className={styles.content}>
          {selectedId ? (
            <>
              <button type="button" className={styles.backBtn} onClick={closeDetail}>
                ← К списку
              </button>
              {detailLoading && !detail ? (
                <div className={styles.loader}>Загрузка…</div>
              ) : detailError && !detail ? (
                <div className={styles.error}>{detailError}</div>
              ) : detail ? (
                <>
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>Статус</span>
                    <span className={`${styles.statusChip} ${statusChipClass(detail.status, detail.resolutionAction)}`}>
                      {subjectReportStatusLabel(detail.status, detail.resolutionAction)}
                    </span>
                    <p className={styles.meta}>{formatDateTime(detail.createdAt)}</p>
                  </div>
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>Причина</span>
                    <p className={styles.sectionText}>{detail.reason?.name || '—'}</p>
                    {detail.reason?.description && (
                      <p className={styles.meta}>{detail.reason.description}</p>
                    )}
                  </div>
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>
                      {REPORT_TARGET_TYPE_LABELS[detail.targetType] || detail.targetType}
                    </span>
                    <ReportTargetPreview report={subjectViewForPreview(detail)} />
                    {detail.eventId && (
                      <Link className={styles.eventLink} to={`/event/${detail.eventId}`}>
                        Открыть мероприятие
                      </Link>
                    )}
                  </div>
                  {detail.moderatorRemark && (
                    detail.resolutionAction === ReportResolutionAction.Warn
                    || detail.resolutionAction === ReportResolutionAction.Other
                  ) && (
                    <div className={styles.section}>
                      <span className={styles.sectionTitle}>Замечание модератора</span>
                      <p className={styles.sectionText}>{detail.moderatorRemark}</p>
                    </div>
                  )}
                  {detail.resolutionAction && (
                    <div className={styles.section}>
                      <span className={styles.sectionTitle}>Итог</span>
                      <p className={styles.sectionText}>
                        {REPORT_RESOLUTION_ACTION_LABELS[detail.resolutionAction]
                          ?? detail.resolutionAction}
                      </p>
                      {detail.resolvedAt && (
                        <p className={styles.meta}>{formatDateTime(detail.resolvedAt)}</p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </>
          ) : loading ? (
            <div className={styles.loader}>Загрузка…</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : reports.length === 0 ? (
            <div className={styles.empty}>Жалоб на ваш контент пока нет</div>
          ) : (
            <>
              {reports.map(report => (
                <button
                  key={report.id}
                  type="button"
                  className={styles.cardItem}
                  onClick={() => openDetail(report.id)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.reasonName}>
                      {report.reason?.name || REPORT_TARGET_TYPE_LABELS[report.targetType]}
                    </span>
                    <span className={`${styles.statusChip} ${statusChipClass(report.status, report.resolutionAction)}`}>
                      {subjectReportStatusLabel(report.status, report.resolutionAction)}
                    </span>
                  </div>
                  <ReportTargetPreview report={subjectViewForPreview(report)} compact />
                  <span className={styles.meta}>
                    {REPORT_TARGET_TYPE_LABELS[report.targetType] || report.targetType}
                    {' · '}
                    {formatDateTime(report.createdAt)}
                  </span>
                </button>
              ))}
              {hasMore && (
                <button
                  type="button"
                  className={styles.moreBtn}
                  disabled={loadingMore}
                  onClick={() => void loadPage(pageIndex + 1, true)}
                >
                  {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
