// features/content-reports/OrganizerReportsModal.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_SEVERITY_LABELS,
  REPORT_STATUS_LABELS,
  ReportResolutionAction,
  ReportSeverity,
  ReportStatus,
  ReportTargetType,
  escalateContentReport,
  fetchContentReport,
  fetchContentReportActions,
  fetchContentReportTargetStats,
  organizerResolutionActionsFor,
  parseTargetSnapshot,
  resolutionActionConfirm,
  resolveContentReport,
  searchOrganizerContentReports,
  takeContentReport,
  canResolveReport,
  canTakeReport,
  takeReportLabel,
  ORGANIZER_PENALTY_TYPES,
  needsDurationHours,
  type IContentReport,
  type IContentReportAction,
  type ReportResolutionActionValue,
  type IContentReportTargetStats,
  type ReportSeverityValue,
  type ReportStatusValue,
} from '@/entities/contentReport';
import { Select } from '@/shared/ui/Select/Select';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { useToastStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { contentReportActionMessage } from './reportSubmitError';
import { ReportTargetPreview } from './ReportTargetPreview';
import {
  ResolutionExtras,
  defaultPenaltyType,
  durationHoursFromFields,
  durationPresetLabel,
} from './ResolutionExtras';
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

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: ReportTargetType.Message, label: 'Сообщение' },
  { value: ReportTargetType.Photo, label: 'Фото' },
];

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

function canEscalate(report: IContentReport, accountId: string | null): boolean {
  if (!canResolveReport(report, 'organizer', accountId)) return false;
  const status = report.organizerStatus ?? report.status;
  return status !== ReportStatus.Escalated;
}

function reportedWho(report: IContentReport): string {
  const snap = parseTargetSnapshot(report.targetSnapshot);
  if (snap?.login) return `@${snap.login}`;
  if (report.reportedAccountId) return report.reportedAccountId;
  return 'автора';
}

export function OrganizerReportsModal({
  eventId,
  onClose,
  onCountChange,
}: OrganizerReportsModalProps) {
  const toast = useToastStore(s => s.add);
  const { accountId } = useAccountId();
  const [onlyActive, setOnlyActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
  const [resolutionAction, setResolutionAction] = useState('');
  const [resolutionComment, setResolutionComment] = useState('');
  const [penaltyType, setPenaltyType] = useState(defaultPenaltyType(ORGANIZER_PENALTY_TYPES));
  const [durationPreset, setDurationPreset] = useState('168');
  const [customHours, setCustomHours] = useState('24');
  const [escalateComment, setEscalateComment] = useState('');
  const [targetStats, setTargetStats] = useState<IContentReportTargetStats | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [escalateConfirmOpen, setEscalateConfirmOpen] = useState(false);

  useModalBackButton(onClose);

  const resolutionOptions = useMemo(() => {
    if (!detail) return [];
    return organizerResolutionActionsFor(detail).map(action => ({
      value: action,
      label: REPORT_RESOLUTION_ACTION_LABELS[action],
    }));
  }, [detail]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await searchOrganizerContentReports(eventId, {
        onlyActive,
        organizerStatus: (statusFilter || null) as ReportStatusValue | null,
        severity: (severityFilter || null) as ReportSeverityValue | null,
        targetType: (typeFilter || null) as typeof ReportTargetType.Message | typeof ReportTargetType.Photo | null,
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
  }, [eventId, onlyActive, statusFilter, severityFilter, typeFilter, onCountChange]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setActions([]);
      setActionError(null);
      setTargetStats(null);
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
        const next = organizerResolutionActionsFor(report);
        setResolutionAction(next[0] ?? '');
        void fetchContentReportTargetStats(report.targetType, report.targetId)
          .then(stats => { if (!cancelled) setTargetStats(stats); })
          .catch(() => { if (!cancelled) setTargetStats(null); });
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
    const next = organizerResolutionActionsFor(report);
    setResolutionAction(next[0] ?? '');
    try {
      setTargetStats(await fetchContentReportTargetStats(report.targetType, report.targetId));
    } catch {
      setTargetStats(null);
    }
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
      setActionError(contentReportActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const applyResolve = async () => {
    if (!detail || busy || !resolutionAction) return;
    if (resolutionAction === ReportResolutionAction.Other && !resolutionComment.trim()) {
      setActionError('Для действия «Другое» нужен комментарий');
      setConfirmOpen(false);
      return;
    }
    if (resolutionAction === ReportResolutionAction.ApplyPenalty && !penaltyType) {
      setActionError('Выберите тип ограничения');
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    setActionError(null);
    setConfirmOpen(false);
    try {
      await resolveContentReport(detail.id, {
        resolutionAction: resolutionAction as ReportResolutionActionValue,
        resolutionComment: resolutionComment.trim() || null,
        penaltyType: resolutionAction === ReportResolutionAction.ApplyPenalty
          ? penaltyType as typeof ORGANIZER_PENALTY_TYPES[number]
          : null,
        durationHours: durationHoursFromFields(
          resolutionAction as ReportResolutionActionValue,
          durationPreset,
          customHours,
        ),
      });
      toast('Жалоба решена', 'success');
      setResolutionComment('');
      await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(contentReportActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResolveClick = () => {
    const confirm = resolutionActionConfirm(resolutionAction as ReportResolutionActionValue);
    if (confirm) {
      setConfirmOpen(true);
      return;
    }
    void applyResolve();
  };

  const handleEscalate = async () => {
    if (!detail || busy || !canEscalate(detail, accountId)) return;
    setBusy(true);
    setActionError(null);
    setEscalateConfirmOpen(false);
    try {
      await escalateContentReport(detail.id, {
        comment: escalateComment.trim() || null,
      });
      toast('Жалоба передана площадке', 'success');
      setEscalateComment('');
      await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(contentReportActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmMeta = resolutionActionConfirm(resolutionAction as ReportResolutionActionValue);

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
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_FILTER_OPTIONS}
            />
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
                    орг: {statusLabel(detail.organizerStatus)}
                    {detail.platformStatus ? ` · площадка: ${statusLabel(detail.platformStatus)}` : ''}
                    {' · '}
                    {formatDateTime(detail.createdAt)}
                  </p>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Объект</span>
                  <ReportTargetPreview report={detail} />
                </div>

                {targetStats && (
                  <div className={styles.section}>
                    <span className={styles.sectionTitle}>Статистика объекта</span>
                    <p className={styles.meta}>
                      всего: {targetStats.totalReports}
                      {' · '}открыто: {targetStats.openReports}
                      {' · '}решено: {targetStats.resolvedReports}
                      {' · '}отклонено: {targetStats.dismissedReports}
                      {' · '}предупреждений: {targetStats.warningCount}
                    </p>
                    {(targetStats.relatedTotalReports > 0 || targetStats.relatedOpenReports > 0) && (
                      <p className={styles.meta}>
                        связанные: {targetStats.relatedTotalReports}
                        {' · '}открыто: {targetStats.relatedOpenReports}
                        {' · '}предупреждений: {targetStats.relatedWarningCount}
                      </p>
                    )}
                    {targetStats.activePenalties.length > 0 && (
                      <p className={styles.meta}>
                        ограничений: {targetStats.activePenalties.length}
                      </p>
                    )}
                  </div>
                )}

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
                    {canTakeReport(detail, 'organizer', accountId) && (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={busy}
                          onClick={() => void handleTake()}
                        >
                          {takeReportLabel(detail, 'organizer', accountId)}
                        </button>
                      </div>
                    )}
                    {!canResolveReport(detail, 'organizer', accountId) && (
                      <p className={styles.meta}>
                        {detail.assignedToAccount?.login
                          ? `В работе у @${detail.assignedToAccount.login}. Сначала возьмите жалобу в работу.`
                          : 'Сначала возьмите жалобу в работу.'}
                      </p>
                    )}

                    <div className={styles.field}>
                      <span className={styles.label}>Решение</span>
                      <Select
                        value={resolutionAction}
                        onChange={setResolutionAction}
                        options={resolutionOptions}
                        disabled={busy || !canResolveReport(detail, 'organizer', accountId)}
                      />
                    </div>
                    <ResolutionExtras
                      action={resolutionAction as ReportResolutionActionValue | ''}
                      penaltyTypes={ORGANIZER_PENALTY_TYPES}
                      penaltyType={penaltyType}
                      onPenaltyTypeChange={setPenaltyType}
                      durationPreset={durationPreset}
                      onDurationPresetChange={setDurationPreset}
                      customHours={customHours}
                      onCustomHoursChange={setCustomHours}
                      disabled={busy || !canResolveReport(detail, 'organizer', accountId)}
                    />
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="org-resolve-comment">
                        Комментарий к решению
                        {resolutionAction === ReportResolutionAction.Other ? ' *' : ''}
                      </label>
                      <textarea
                        id="org-resolve-comment"
                        className={styles.textarea}
                        value={resolutionComment}
                        onChange={e => setResolutionComment(e.target.value)}
                        disabled={busy || !canResolveReport(detail, 'organizer', accountId)}
                        rows={3}
                        placeholder={
                          resolutionAction === ReportResolutionAction.Other
                            ? 'Обязательный комментарий'
                            : 'Необязательно'
                        }
                      />
                    </div>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={busy || !resolutionAction || !canResolveReport(detail, 'organizer', accountId)}
                        onClick={handleResolveClick}
                      >
                        Применить
                      </button>
                    </div>

                    {canEscalate(detail, accountId) && (
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
                            onClick={() => setEscalateConfirmOpen(true)}
                          >
                            Передать на площадку
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
                  <ReportTargetPreview report={report} compact />
                  <span className={styles.meta}>
                    {report.reporter ? `@${report.reporter.login}` : ''}
                    {report.reporter ? ' · ' : ''}
                    {formatDateTime(report.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {confirmOpen && confirmMeta && (
        <ConfirmDialog
          title={confirmMeta.title}
          message={
            resolutionAction === ReportResolutionAction.BanFromEvent && detail
              ? `${confirmMeta.message} Будет забанен ${reportedWho(detail)}. Срок: ${durationPresetLabel(durationPreset, customHours)}.`
              : needsDurationHours(resolutionAction as ReportResolutionActionValue)
                ? `${confirmMeta.message} Срок: ${durationPresetLabel(durationPreset, customHours)}.`
                : confirmMeta.message
          }
          confirmLabel={busy ? '…' : confirmMeta.confirmLabel}
          cancelLabel="Назад"
          onConfirm={() => void applyResolve()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {escalateConfirmOpen && (
        <ConfirmDialog
          title="Передать на площадку?"
          message="Жалоба останется у организаторов и дополнительно уйдёт модераторам площадки."
          confirmLabel={busy ? '…' : 'Передать'}
          cancelLabel="Назад"
          onConfirm={() => void handleEscalate()}
          onCancel={() => setEscalateConfirmOpen(false)}
        />
      )}
    </>,
    document.body,
  );
}
