// pages/admin/PlatformModerationTab.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MODERATION_PENALTY_TYPE_LABELS,
  PLATFORM_PENALTY_TYPES,
  REPORT_RESOLUTION_ACTION_LABELS,
  REPORT_SEVERITY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  ReportResolutionAction,
  ReportSeverity,
  ReportStatus,
  ReportTargetType,
  canResolveReport,
  canTakeReport,
  fetchContentReport,
  fetchContentReportActions,
  fetchContentReportTargetStats,
  fetchPlatformContentReportsCount,
  platformResolutionActionsFor,
  resolutionActionConfirm,
  resolveContentReport,
  revokeModerationPenalty,
  searchPlatformContentReports,
  takeContentReport,
  takeReportLabel,
  needsDurationHours,
  type IContentReport,
  type IContentReportAction,
  type IContentReportTargetStats,
  type IModerationPenalty,
  type ReportResolutionActionValue,
  type ReportSeverityValue,
  type ReportStatusValue,
  type ReportTargetTypeValue,
} from '@/entities/contentReport';
import { Select } from '@/shared/ui/Select/Select';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { useToastStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { ReportTargetPreview } from '@/features/content-reports';
import { contentReportActionMessage } from '@/features/content-reports/reportSubmitError';
import {
  ResolutionExtras,
  defaultPenaltyType,
  durationHoursFromFields,
  durationPresetLabel,
} from '@/features/content-reports/ResolutionExtras';
import styles from './AdminPage.module.css';
import tabStyles from './PlatformModerationTab.module.css';

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

const TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Все' },
  { value: '__safety', label: 'Safety' },
  { value: ReportTargetType.Event, label: 'События' },
  { value: ReportTargetType.Message, label: 'Сообщения' },
  { value: ReportTargetType.Photo, label: 'Фото' },
  { value: ReportTargetType.Account, label: 'Профили' },
  { value: ReportTargetType.Organization, label: 'Организации' },
  { value: ReportTargetType.EventOrganizator, label: 'Организаторы' },
];

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
  if (status === ReportStatus.Resolved) return tabStyles.statusResolved;
  if (status === ReportStatus.Dismissed) return tabStyles.statusDismissed;
  if (status === ReportStatus.InReview) return tabStyles.statusReview;
  if (status === ReportStatus.Escalated) return tabStyles.statusEscalated;
  return tabStyles.statusOpen;
}

function canModerate(report: IContentReport): boolean {
  const s = report.platformStatus ?? report.status;
  return s === ReportStatus.Open || s === ReportStatus.InReview;
}

interface PlatformModerationTabProps {
  onActiveCountChange?: (count: number) => void;
}

export function PlatformModerationTab({ onActiveCountChange }: PlatformModerationTabProps) {
  const toast = useToastStore(s => s.add);
  const { accountId } = useAccountId();
  const [onlyActive, setOnlyActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeTab, setTypeTab] = useState('');
  const [reports, setReports] = useState<IContentReport[]>([]);
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
  const [penaltyType, setPenaltyType] = useState(defaultPenaltyType(PLATFORM_PENALTY_TYPES));
  const [durationPreset, setDurationPreset] = useState('168');
  const [customHours, setCustomHours] = useState('24');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetStats, setTargetStats] = useState<IContentReportTargetStats | null>(null);
  const [listStats, setListStats] = useState<Record<string, IContentReportTargetStats>>({});
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);

  const safetyTab = typeTab === '__safety';
  const targetTypeFilter = safetyTab ? null : ((typeTab || null) as ReportTargetTypeValue | null);
  const severityForSearch = safetyTab
    ? ReportSeverity.Safety
    : ((severityFilter || null) as ReportSeverityValue | null);

  const resolutionOptions = useMemo(() => {
    if (!detail) return [];
    return platformResolutionActionsFor(detail).map(action => ({
      value: action,
      label: REPORT_RESOLUTION_ACTION_LABELS[action],
    }));
  }, [detail]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, activeCount] = await Promise.all([
        searchPlatformContentReports({
          onlyActive,
          inPlatformQueue: true,
          platformStatus: (statusFilter || null) as ReportStatusValue | null,
          severity: severityForSearch,
          targetType: targetTypeFilter,
          pageIndex: 0,
          pageSize: 50,
        }),
        fetchPlatformContentReportsCount(true).catch(() => 0),
      ]);
      setReports(page.result);
      onActiveCountChange?.(activeCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить очередь');
    } finally {
      setLoading(false);
    }
  }, [onlyActive, statusFilter, severityForSearch, targetTypeFilter, onActiveCountChange]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const unique = new Map<string, { type: ReportTargetTypeValue; id: string }>();
    for (const report of reports) {
      unique.set(`${report.targetType}:${report.targetId}`, {
        type: report.targetType,
        id: report.targetId,
      });
    }
    if (unique.size === 0) {
      setListStats({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      [...unique.values()].map(item =>
        fetchContentReportTargetStats(item.type, item.id)
          .then(stats => [`${item.type}:${item.id}`, stats] as const)
          .catch(() => null),
      ),
    ).then(rows => {
      if (cancelled) return;
      const next: Record<string, IContentReportTargetStats> = {};
      for (const row of rows) {
        if (row) next[row[0]] = row[1];
      }
      setListStats(next);
    });
    return () => { cancelled = true; };
  }, [reports]);

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
        const next = platformResolutionActionsFor(report);
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
    const next = platformResolutionActionsFor(report);
    setResolutionAction(next[0] ?? '');
    try {
      setTargetStats(await fetchContentReportTargetStats(report.targetType, report.targetId));
    } catch {
      setTargetStats(null);
    }
  };

  const handleRevokePenalty = async (penalty: IModerationPenalty) => {
    if (busy || revokeBusyId) return;
    setRevokeBusyId(penalty.id);
    setActionError(null);
    try {
      await revokeModerationPenalty(penalty.id);
      toast('Ограничение снято', 'success');
      if (detail) await refreshAfterAction(detail.id);
    } catch (e) {
      setActionError(contentReportActionMessage(e));
    } finally {
      setRevokeBusyId(null);
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
          ? penaltyType as typeof PLATFORM_PENALTY_TYPES[number]
          : null,
        durationHours: durationHoursFromFields(
          resolutionAction as ReportResolutionActionValue,
          durationPreset,
          customHours,
        ),
      });
      toast(
        resolutionAction === ReportResolutionAction.CancelEvent
          ? 'Мероприятие отменено, жалоба закрыта'
          : 'Жалоба решена',
        'success',
      );
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

  return (
    <div className={styles.splitPane}>
      <div className={`${styles.listPane} ${selectedId ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Очередь площадки</h2>
        </div>
        <div className={tabStyles.typeTabs} role="tablist" aria-label="Тип жалобы">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={typeTab === tab.value}
              className={`${tabStyles.typeTab} ${typeTab === tab.value ? tabStyles.typeTabActive : ''}`}
              onClick={() => setTypeTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={tabStyles.filters}>
          <label className={tabStyles.activeToggle}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={e => setOnlyActive(e.target.checked)}
            />
            Только активные
          </label>
          <Select
            className={tabStyles.filterSelect}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
          />
          {!safetyTab && (
            <Select
              className={tabStyles.filterSelect}
              value={severityFilter}
              onChange={setSeverityFilter}
              options={SEVERITY_FILTER_OPTIONS}
            />
          )}
        </div>

        <div className={styles.itemList}>
          {loading ? (
            <div className={styles.loader}>Загрузка...</div>
          ) : error ? (
            <div className={styles.errorMsg}>{error}</div>
          ) : reports.length === 0 ? (
            <div className={styles.groupEmpty}>Активных жалоб нет</div>
          ) : (
            reports.map(report => {
              const safety = report.reason?.severity === ReportSeverity.Safety;
              const st = report.platformStatus ?? report.status;
              return (
                <div
                  key={report.id}
                  className={`${styles.typeRow} ${tabStyles.row} ${selectedId === report.id ? styles.listRowActive : ''}`}
                  onClick={() => setSelectedId(report.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(report.id);
                    }
                  }}
                >
                  <div className={styles.itemInfo}>
                    <span className={`${styles.itemName} ${tabStyles.itemNameRow}`}>
                      {report.reason?.name || 'Жалоба'}
                      {safety && (
                        <span className={`${tabStyles.statusChip} ${tabStyles.safetyChip}`}>
                          серьёзное
                        </span>
                      )}
                    </span>
                    <span className={`${styles.itemSub} ${tabStyles.snapshot}`}>
                      {REPORT_TARGET_TYPE_LABELS[report.targetType] || report.targetType}
                      {report.eventName ? ` · ${report.eventName}` : ''}
                    </span>
                    <ReportTargetPreview report={report} compact />
                    {listStats[`${report.targetType}:${report.targetId}`] && (
                      <span className={tabStyles.listStats}>
                        всего: {listStats[`${report.targetType}:${report.targetId}`].totalReports}
                        {' · '}открыто: {listStats[`${report.targetType}:${report.targetId}`].openReports}
                        {listStats[`${report.targetType}:${report.targetId}`].warningCount > 0
                          ? ` · предупреждений: ${listStats[`${report.targetType}:${report.targetId}`].warningCount}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <span className={`${tabStyles.statusChip} ${statusChipClass(st)}`}>
                    {statusLabel(st)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`${styles.formPane} ${!selectedId ? styles.mobileHidden : ''}`}>
        <button type="button" className={styles.mobileBackBtn} onClick={() => setSelectedId(null)}>
          ← Назад к списку
        </button>
        {!selectedId ? (
          <div className={styles.emptyForm}>
            <p>Выберите жалобу для просмотра</p>
          </div>
        ) : detailLoading && !detail ? (
          <div className={styles.loader}>Загрузка...</div>
        ) : !detail ? (
          <div className={styles.errorMsg}>{actionError || 'Жалоба не найдена'}</div>
        ) : (
          <div className={`${styles.form} ${tabStyles.detail}`}>
            <h3 className={styles.formTitle}>{detail.reason?.name || 'Жалоба'}</h3>

            <div className={tabStyles.badgeRow}>
              <span className={`${tabStyles.statusChip} ${statusChipClass(detail.platformStatus ?? detail.status)}`}>
                площадка: {statusLabel(detail.platformStatus ?? detail.status)}
              </span>
              {detail.organizerStatus && (
                <span className={`${tabStyles.statusChip} ${statusChipClass(detail.organizerStatus)}`}>
                  орг: {statusLabel(detail.organizerStatus)}
                </span>
              )}
              {detail.reason?.severity === ReportSeverity.Safety && (
                <span className={`${tabStyles.statusChip} ${tabStyles.safetyChip}`}>серьёзное</span>
              )}
            </div>

            <div className={tabStyles.metaGrid}>
              <div>
                <div className={styles.label}>Тип</div>
                <div className={tabStyles.metaValue}>
                  {REPORT_TARGET_TYPE_LABELS[detail.targetType] || detail.targetType}
                </div>
              </div>
              <div>
                <div className={styles.label}>Автор жалобы</div>
                <div className={tabStyles.metaValue}>
                  {detail.reporter?.login ? `@${detail.reporter.login}` : detail.reporterAccountId || '—'}
                </div>
              </div>
              <div>
                <div className={styles.label}>Создано</div>
                <div className={tabStyles.metaValue}>{formatDateTime(detail.createdAt)}</div>
              </div>
              <div>
                <div className={styles.label}>Назначена</div>
                <div className={tabStyles.metaValue}>
                  {detail.assignedToAccount?.login
                    ? `@${detail.assignedToAccount.login}`
                    : '—'}
                </div>
              </div>
            </div>

            {targetStats && (
              <div className={tabStyles.statsRow}>
                <div>
                  всего: {targetStats.totalReports}
                  {' · '}открыто: {targetStats.openReports}
                  {' · '}решено: {targetStats.resolvedReports}
                  {' · '}отклонено: {targetStats.dismissedReports}
                  {' · '}предупреждений: {targetStats.warningCount}
                </div>
                {(targetStats.relatedTotalReports > 0 || targetStats.relatedOpenReports > 0) && (
                  <div>
                    связанные: {targetStats.relatedTotalReports}
                    {' · '}открыто: {targetStats.relatedOpenReports}
                    {' · '}предупреждений: {targetStats.relatedWarningCount}
                  </div>
                )}
                {targetStats.activePenalties.length > 0 && (
                  <div>ограничений: {targetStats.activePenalties.length}</div>
                )}
                {targetStats.lastReportAt && (
                  <div className={tabStyles.statsDate}>
                    последняя жалоба: {formatDateTime(targetStats.lastReportAt)}
                    {targetStats.lastWarningAt
                      ? ` · последнее предупреждение: ${formatDateTime(targetStats.lastWarningAt)}`
                      : ''}
                  </div>
                )}
              </div>
            )}
            {targetStats && targetStats.activePenalties.length > 0 && (
              <div className={styles.field}>
                <span className={styles.label}>Действующие ограничения</span>
                {targetStats.activePenalties.map(penalty => (
                  <div key={penalty.id} className={tabStyles.penaltyRow}>
                    <span>
                      {MODERATION_PENALTY_TYPE_LABELS[penalty.penaltyType] || penalty.penaltyType}
                      {penalty.endsAt ? ` · до ${formatDateTime(penalty.endsAt)}` : ' · бессрочно'}
                    </span>
                    <button
                      type="button"
                      className={tabStyles.revokeBtn}
                      disabled={busy || revokeBusyId === penalty.id}
                      onClick={() => void handleRevokePenalty(penalty)}
                    >
                      {revokeBusyId === penalty.id ? '…' : 'Снять'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {detail.eventId && (
              <div className={styles.field}>
                <span className={styles.label}>Мероприятие</span>
                <Link className={tabStyles.eventLink} to={`/event/${detail.eventId}`}>
                  {detail.eventName || detail.eventId}
                </Link>
              </div>
            )}

            <div className={styles.field}>
              <span className={styles.label}>Объект</span>
              <ReportTargetPreview report={detail} />
            </div>

            {detail.comment && (
              <div className={styles.field}>
                <span className={styles.label}>Комментарий жалобщика</span>
                <p className={tabStyles.description}>{detail.comment}</p>
              </div>
            )}

            {actions.length > 0 && (
              <div className={styles.field}>
                <span className={styles.label}>История</span>
                {actions.map(a => (
                  <p key={a.id} className={tabStyles.historyItem}>
                    {formatDateTime(a.createdAt)} · {a.action}
                    {a.details ? ` — ${a.details}` : ''}
                  </p>
                ))}
              </div>
            )}

            {canModerate(detail) && (
              <>
                {canTakeReport(detail, 'platform', accountId) && (
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      disabled={busy}
                      onClick={() => void handleTake()}
                    >
                      {takeReportLabel(detail, 'platform', accountId)}
                    </button>
                  </div>
                )}
                {!canResolveReport(detail, 'platform', accountId) && (
                  <p className={tabStyles.description}>
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
                    disabled={busy || !canResolveReport(detail, 'platform', accountId)}
                  />
                </div>
                <ResolutionExtras
                  action={resolutionAction as ReportResolutionActionValue | ''}
                  penaltyTypes={PLATFORM_PENALTY_TYPES}
                  penaltyType={penaltyType}
                  onPenaltyTypeChange={setPenaltyType}
                  durationPreset={durationPreset}
                  onDurationPresetChange={setDurationPreset}
                  customHours={customHours}
                  onCustomHoursChange={setCustomHours}
                  disabled={busy || !canResolveReport(detail, 'platform', accountId)}
                />
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="platform-resolve-comment">
                    Комментарий к решению
                    {resolutionAction === ReportResolutionAction.Other ? ' *' : ''}
                  </label>
                  <textarea
                    id="platform-resolve-comment"
                    className={styles.textarea}
                    value={resolutionComment}
                    onChange={e => setResolutionComment(e.target.value)}
                    disabled={busy || !canResolveReport(detail, 'platform', accountId)}
                    rows={3}
                    placeholder={
                      resolutionAction === ReportResolutionAction.Other
                        ? 'Обязательный комментарий'
                        : 'Необязательно'
                    }
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    disabled={busy || !resolutionAction || !canResolveReport(detail, 'platform', accountId)}
                    onClick={handleResolveClick}
                  >
                    {busy ? '...' : 'Применить'}
                  </button>
                </div>
              </>
            )}

            {actionError && <div className={styles.formError}>{actionError}</div>}
          </div>
        )}
      </div>

      {confirmOpen && (
        <PlatformResolveConfirm
          action={resolutionAction as ReportResolutionActionValue}
          durationLabel={
            needsDurationHours(resolutionAction as ReportResolutionActionValue)
              ? durationPresetLabel(durationPreset, customHours)
              : null
          }
          busy={busy}
          onConfirm={() => void applyResolve()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

function PlatformResolveConfirm({
  action,
  durationLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  action: ReportResolutionActionValue;
  durationLabel: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const meta = resolutionActionConfirm(action);
  if (!meta) return null;
  const message = durationLabel
    ? `${meta.message} Срок: ${durationLabel}.`
    : meta.message;
  return (
    <ConfirmDialog
      title={meta.title}
      message={message}
      confirmLabel={busy ? '…' : meta.confirmLabel}
      cancelLabel="Назад"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
