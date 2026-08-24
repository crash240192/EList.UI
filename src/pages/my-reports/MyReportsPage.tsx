// pages/my-reports/MyReportsPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  ReportStatus,
  ReportTargetType,
  fetchContentReport,
  fetchContentReportActions,
  fetchMyContentReports,
  type IContentReport,
  type IContentReportAction,
  type ReportStatusValue,
} from '@/entities/contentReport';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { usePageTitle } from '@/shared/hooks';
import { ReportTargetPreview } from '@/features/content-reports';
import styles from '@/features/content-reports/reportInbox.module.css';

const PAGE_SIZE = 20;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function statusLabel(status: ReportStatusValue | null | undefined): string {
  if (!status) return '—';
  return REPORT_STATUS_LABELS[status] ?? status;
}

function statusChipClass(status: ReportStatusValue | null | undefined): string {
  if (status === ReportStatus.Resolved) return styles.statusResolved;
  if (status === ReportStatus.Dismissed) return styles.statusDismissed;
  if (status === ReportStatus.InReview) return styles.statusReview;
  if (status === ReportStatus.Escalated) return styles.statusEscalated;
  return styles.statusOpen;
}

export default function MyReportsPage() {
  usePageTitle('Мои жалобы');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialReportId = searchParams.get('report');
  const fromSettings = searchParams.get('from') === 'settings-moderation';

  const [reports, setReports] = useState<IContentReport[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId);
  const [detail, setDetail] = useState<IContentReport | null>(null);
  const [actions, setActions] = useState<IContentReportAction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadPage = useCallback(async (index: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await fetchMyContentReports(index, PAGE_SIZE);
      setTotal(page.total);
      setPageIndex(index);
      setReports(prev => (append ? [...prev, ...page.result] : page.result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить жалобы');
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
      setActions([]);
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
    Promise.all([
      fetchContentReport(selectedId),
      fetchContentReportActions(selectedId).catch(() => [] as IContentReportAction[]),
    ])
      .then(([report, acts]) => {
        if (cancelled) return;
        setDetail(report);
        setActions(acts);
      })
      .catch(e => {
        if (cancelled) return;
        setDetailError(e instanceof Error ? e.message : 'Не удалось загрузить жалобу');
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

  const againstMeHref = fromSettings
    ? '/reports-against-me?from=settings-moderation'
    : '/reports-against-me';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <h1 className={styles.cardTitle}>Мои жалобы</h1>
              {!loading && !selectedId && total > 0 && (
                <span className={styles.count}>{total}</span>
              )}
            </div>
            <p className={styles.subtitle}>
              Исходящие жалобы на чужой контент и статус их рассмотрения.
            </p>
          </div>
          {!selectedId && (
            <Link className={styles.headerLink} to={againstMeHref}>
              Жалобы на меня
            </Link>
          )}
        </div>

        <div className={styles.content}>
          {fromSettings && !selectedId && (
            <Link className={styles.backBtn} to="/settings?tab=moderation">
              ← В модерацию
            </Link>
          )}

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
                <div className={styles.detail}>
                  <div className={styles.statusBanner}>
                    <div className={styles.statusBannerMain}>
                      <span className={`${styles.statusChip} ${statusChipClass(detail.status)}`}>
                        {statusLabel(detail.status)}
                      </span>
                      <span className={styles.itemMeta}>{formatDateTime(detail.createdAt)}</span>
                    </div>
                    <span className={styles.itemType}>
                      {REPORT_TARGET_TYPE_LABELS[detail.targetType] || detail.targetType}
                    </span>
                  </div>

                  <div>
                    <h2 className={styles.detailTitle}>{detail.reason?.name || 'Жалоба'}</h2>
                    {detail.reason?.description && (
                      <p className={styles.detailLead}>{detail.reason.description}</p>
                    )}
                  </div>

                  <hr className={styles.divider} />

                  <div className={styles.block}>
                    <span className={styles.blockLabel}>Объект</span>
                    <ReportTargetPreview report={detail} />
                    {detail.eventId && detail.targetType !== ReportTargetType.Event && (
                      <Link className={styles.eventLink} to={`/event/${detail.eventId}`}>
                        {detail.eventName || 'Открыть мероприятие'}
                      </Link>
                    )}
                  </div>

                  {detail.comment && (
                    <div className={styles.block}>
                      <span className={styles.blockLabel}>Ваш комментарий</span>
                      <p className={styles.blockText}>{detail.comment}</p>
                    </div>
                  )}

                  {(detail.resolutionAction || detail.resolutionComment) && (
                    <div className={styles.block}>
                      <span className={styles.blockLabel}>Решение</span>
                      {detail.resolutionAction && (
                        <p className={styles.blockText}>
                          {REPORT_RESOLUTION_ACTION_LABELS[detail.resolutionAction]
                            ?? detail.resolutionAction}
                        </p>
                      )}
                      {detail.resolutionComment && (
                        <p className={styles.itemMeta}>{detail.resolutionComment}</p>
                      )}
                      {detail.resolvedAt && (
                        <p className={styles.itemMeta}>{formatDateTime(detail.resolvedAt)}</p>
                      )}
                    </div>
                  )}

                  {actions.length > 0 && (
                    <div className={styles.block}>
                      <span className={styles.blockLabel}>История</span>
                      <ul className={styles.historyList}>
                        {actions.map(a => (
                          <li key={a.id} className={styles.historyItem}>
                            {formatDateTime(a.createdAt)} · {a.action}
                            {a.details ? ` — ${a.details}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : loading ? (
            <div className={styles.loader}>Загрузка…</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : reports.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Жалоб пока нет</p>
              <p className={styles.emptySub}>
                Когда вы пожалуетесь на мероприятие, сообщение или профиль, статус появится здесь.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.list}>
                {reports.map(report => (
                  <button
                    key={report.id}
                    type="button"
                    className={styles.item}
                    onClick={() => openDetail(report.id)}
                  >
                    <div className={styles.itemTop}>
                      <div className={styles.itemTitleBlock}>
                        <span className={styles.itemType}>
                          {REPORT_TARGET_TYPE_LABELS[report.targetType] || report.targetType}
                        </span>
                        <span className={styles.itemTitle}>
                          {report.reason?.name || 'Жалоба'}
                        </span>
                      </div>
                      <span className={`${styles.statusChip} ${statusChipClass(report.status)}`}>
                        {statusLabel(report.status)}
                      </span>
                    </div>
                    <ReportTargetPreview report={report} compact />
                    <span className={styles.itemMeta}>
                      {report.eventName ? `${report.eventName} · ` : ''}
                      {formatDateTime(report.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
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
