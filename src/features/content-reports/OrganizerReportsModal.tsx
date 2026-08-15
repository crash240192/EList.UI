// features/content-reports/OrganizerReportsModal.tsx

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ORGANIZER_RESOLUTION_ACTIONS,
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_SEVERITY_LABELS,
  REPORT_STATUS_LABELS,
  ReportSeverity,
  ReportStatus,
  ReportTargetType,
  escalateContentReport,
  fetchContentReport,
  fetchContentReportActions,
  resolveContentReport,
  searchOrganizerContentReports,
  takeContentReport,
  type IContentReport,
  type IContentReportAction,
  type ReportResolutionActionValue,
  type ReportSeverityValue,
  type ReportStatusValue,
} from '@/entities/contentReport';
import { Select } from '@/shared/ui/Select/Select';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { useToastStore } from '@/app/store';
import styles from './OrganizerReportsModal.module.css';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: ReportStatus.Open, label: REPORT_STATUS_LABELS.Open },
  { value: ReportStatus.InReview, label: REPORT_STATUS_LABELS.InReview },
  { value: ReportStatus.Escalated, label: REPORT_STATUS_LABELS.Escalated },
  { value: ReportStatus.Resolved, label: REPORT_STATUS_LABELS.Resolved },
  { value: ReportStatus.Dismissed, label: REPORT_STATUS_LABELS.Dismissed },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: '', label: 'Любая серьёзность' },
  { value: ReportSeverity.Safety, label: REPORT_SEVERITY_LABELS.Safety },
  { value: ReportSeverity.Community, label: REPORT_SEVERITY_LABELS.Community },
];

const RESOLUTION_OPTIONS = ORGANIZER_RESOLUTION_ACTIONS.map(action => ({
  value: action,
  label: REPORT_RESOLUTION_ACTION_LABELS[action],
}));

interface OrganizerReportsModalProps {
  eventId: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function statusLabel(status: ReportStatusValue | null | undefined): string {
  if (!status) return '—';
  return REPORT_STATUS_LABELS[status] ?? status;
}

function canModerate(report: IContentReport): boolean {
  const s = report.organizerStatus ?? report.status;
  return s === ReportStatus.Open || s === ReportStatus.InReview;
}

function canEscalate(report: IContentReport): boolean {
  if (!canModerate(report)) return false;
  return report.reason?.severity === ReportSeverity.Safety;
}

export function OrganizerReportsModal({
  eventId,
  onClose,
  onCountChange,
}: OrganizerReportsModalProps) {
  const toast = useToastStore(s => s.add);
  const [onlyActive, setOnlyActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [reports, setReports] = useState<IContentReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IContentReport | null>(null);
  const [actions, setActions] = useState<IContentReportAction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>(
    ORGANIZER_RESOLUTION_ACTIONS[0],
  );
  const [resolutionComment, setResolutionComment] = useState('');
  const [escalateComment, setEscalateComment] = useState('');

  useModalBackButton(onClose);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await searchOrganizerContentReports(eventId, {
        onlyActive,
        organizerStatus: (statusFilter || null) as ReportStatusValue | null,
        severity: (severityFilter || null) as ReportSeverityValue | null,
        pageIndex: 0,
        pageSize: 50,
      });
      setReports(page.result);
      setTotal(page.total);
      onCountChange?.(onlyActive ? page.total : page.result.filter(r => {
        const s = r.organizerStatus ?? r.status;
        return s === ReportStatus.Open || s === ReportStatus.InReview || s === ReportStatus.Escalated;
      }).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить жалобы');
    } finally {
      setLoading(false);
    }
  }, [eventId, onlyActive, statusFilter, severityFilter, onCountChange]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setActions([]);
      setActionError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setActionError(null);
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
        setActionError(e instanceof Error ? e.message : 'Не удалось загрузить жалобу');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const refreshAfterAction = async (reportId: string) => {
    await loadList();
    const [report, acts] = await Promise.all([
      fetchContentReport(reportId),
      fetchContentReportActions(reportId).catch(() => [] as IContentReportAction[]),
    ]);
    setDetail(report);
    setActions(acts);
  };

  const handleTake = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await takeContentReport(detail.id);
      toast('Жалоба взята в работу', 'success');
      await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось взять жалобу');
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!detail || busy || !resolutionAction) return;
    setBusy(true);
    setActionError(null);
    try {
      await resolveContentReport(detail.id, {
        resolutionAction: resolutionAction as ReportResolutionActionValue,
        resolutionComment: resolutionComment.trim() || null,
      });
      toast('Жалоба решена', 'success');
      setResolutionComment('');
      await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось решить жалобу');
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async () => {
    if (!detail || busy || !canEscalate(detail)) return;
    setBusy(true);
    setActionError(null);
    try {
      await escalateContentReport(detail.id, {
        comment: escalateComment.trim() || null,
      });
      toast('Жалоба передана площадке', 'success');
      setEscalateComment('');
      await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось эскалировать');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="org-reports-title">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 id="org-reports-title" className={styles.title}>Жалобы</h3>
            {!loading && <span className={styles.count}>{total}</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!selectedId && (
          <div className={styles.filters}>
            <label className={styles.activeToggle}>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={e => setOnlyActive(e.target.checked)}
              />
              Только активные
            </label>
            <Select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
            <Select
              className={styles.filterSelect}
              value={severityFilter}
              onChange={setSeverityFilter}
              options={SEVERITY_FILTER_OPTIONS}
            />
          </div>
        )}

        <div className={styles.body}>
          {selectedId ? (
            detailLoading && !detail ? (
              <div className={styles.empty}>Загрузка…</div>
            ) : !detail ? (
              <div className={styles.error}>{actionError || 'Жалоба не найдена'}</div>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setSelectedId(null)}
                  >
                    ← К списку
                  </button>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Причина</span>
                  <div className={styles.cardTop}>
                    <span className={styles.reasonName}>
                      {detail.reason?.name || 'Без причины'}
                    </span>
                    {detail.reason?.severity === ReportSeverity.Safety && (
                      <span className={`${styles.badge} ${styles.badgeSafety}`}>
                        серьёзное
                      </span>
                    )}
                    {detail.platformStatus && (
                      <span className={`${styles.badge} ${styles.badgePlatform}`}>
                        также у площадки
                      </span>
                    )}
                  </div>
                  <p className={styles.meta}>
                    {detail.targetType === ReportTargetType.Message ? 'Сообщение' : 'Мероприятие'}
                    {' · '}
                    орг: {statusLabel(detail.organizerStatus)}
                    {' · '}
                    {formatDateTime(detail.createdAt)}
                  </p>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Контент</span>
                  <p className={styles.sectionText}>
                    {detail.targetSnapshot?.trim() || '—'}
                  </p>
                </div>

                {(detail.comment || detail.reporter) && (
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>Жалоба</span>
                    {detail.reporter && (
                      <p className={styles.meta}>@{detail.reporter.login}</p>
                    )}
                    {detail.comment && (
                      <p className={styles.sectionText}>{detail.comment}</p>
                    )}
                  </div>
                )}

                {actions.length > 0 && (
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>История</span>
                    {actions.map(a => (
                      <p key={a.id} className={styles.meta}>
                        {formatDateTime(a.createdAt)} · {a.action}
                        {a.details ? ` — ${a.details}` : ''}
                      </p>
                    ))}
                  </div>
                )}

                {canModerate(detail) && (
                  <div className={styles.actions}>
                    {(detail.organizerStatus ?? detail.status) === ReportStatus.Open && (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={busy}
                          onClick={() => void handleTake()}
                        >
                          Взять в работу
                        </button>
                      </div>
                    )}

                    <div className={styles.field}>
                      <span className={styles.label}>Решение</span>
                      <Select
                        value={resolutionAction}
                        onChange={setResolutionAction}
                        options={RESOLUTION_OPTIONS}
                        disabled={busy}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="org-resolve-comment">
                        Комментарий к решению
                      </label>
                      <textarea
                        id="org-resolve-comment"
                        className={styles.textarea}
                        value={resolutionComment}
                        onChange={e => setResolutionComment(e.target.value)}
                        disabled={busy}
                        rows={3}
                        placeholder="Необязательно"
                      />
                    </div>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={busy || !resolutionAction}
                        onClick={() => void handleResolve()}
                      >
                        Применить
                      </button>
                    </div>

                    {canEscalate(detail) && (
                      <>
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="org-escalate-comment">
                            Эскалация на площадку
                          </label>
                          <textarea
                            id="org-escalate-comment"
                            className={styles.textarea}
                            value={escalateComment}
                            onChange={e => setEscalateComment(e.target.value)}
                            disabled={busy}
                            rows={2}
                            placeholder="Комментарий для модераторов (необязательно)"
                          />
                        </div>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            disabled={busy}
                            onClick={() => void handleEscalate()}
                          >
                            Эскалировать
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {actionError && <div className={styles.inlineError}>{actionError}</div>}
              </>
            )
          ) : loading ? (
            <div className={styles.empty}>Загрузка…</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : reports.length === 0 ? (
            <div className={styles.empty}>Жалоб пока нет</div>
          ) : (
            reports.map(report => {
              const safety = report.reason?.severity === ReportSeverity.Safety;
              return (
                <button
                  key={report.id}
                  type="button"
                  className={`${styles.card} ${safety ? styles.cardSafety : ''}`}
                  onClick={() => setSelectedId(report.id)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.reasonName}>
                      {report.reason?.name || 'Жалоба'}
                    </span>
                    {safety && (
                      <span className={`${styles.badge} ${styles.badgeSafety}`}>серьёзное</span>
                    )}
                    {report.platformStatus && (
                      <span className={`${styles.badge} ${styles.badgePlatform}`}>
                        также у площадки
                      </span>
                    )}
                    <span className={styles.badge}>
                      {statusLabel(report.organizerStatus ?? report.status)}
                    </span>
                  </div>
                  {report.targetSnapshot && (
                    <p className={styles.snapshot}>{report.targetSnapshot}</p>
                  )}
                  <span className={styles.meta}>
                    {report.targetType === ReportTargetType.Message ? 'Сообщение' : 'Мероприятие'}
                    {report.reporter ? ` · @${report.reporter.login}` : ''}
                    {' · '}
                    {formatDateTime(report.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
