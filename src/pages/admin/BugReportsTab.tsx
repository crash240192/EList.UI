// pages/admin/BugReportsTab.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BUG_REPORT_STATUS_LABELS,
  fetchBugReportCategories,
  searchBugReports,
  updateBugReportStatus,
  type BugReportStatus,
  type IBugReport,
  type IBugReportCategory,
} from '@/entities/bugReport';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { Select } from '@/shared/ui/Select/Select';
import { apiIsoToLocalParts } from '@/shared/lib/datetime';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';
import styles from './AdminPage.module.css';
import reportStyles from './BugReportsTab.module.css';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'Pending', label: BUG_REPORT_STATUS_LABELS.Pending },
  { value: 'Resolved', label: BUG_REPORT_STATUS_LABELS.Resolved },
  { value: 'Cancelled', label: BUG_REPORT_STATUS_LABELS.Cancelled },
];

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const { date, time } = apiIsoToLocalParts(iso);
  return `${date} ${time}`;
}

function statusClass(status: BugReportStatus): string {
  if (status === 'Resolved') return reportStyles.statusResolved;
  if (status === 'Cancelled') return reportStyles.statusCancelled;
  return reportStyles.statusPending;
}

export function BugReportsTab() {
  const [categories, setCategories] = useState<IBugReportCategory[]>([]);
  const [reports, setReports] = useState<IBugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, page] = await Promise.all([
        fetchBugReportCategories(false),
        searchBugReports({
          status: (statusFilter || null) as BugReportStatus | null,
          pageIndex: 0,
          pageSize: 200,
        }),
      ]);
      setCategories(cats);
      setReports(page.result);
      setExpanded(prev => {
        if (prev.size > 0) return prev;
        const pendingCats = new Set<string>();
        for (const r of page.result) {
          if (r.status === 'Pending') pendingCats.add(r.categoryId || '__none__');
        }
        if (pendingCats.size === 0 && cats[0]) pendingCats.add(cats[0].id);
        return pendingCats;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const byId = new Map<string, { category: IBugReportCategory | null; items: IBugReport[] }>();
    for (const cat of categories) {
      byId.set(cat.id, { category: cat, items: [] });
    }
    for (const report of reports) {
      const key = report.categoryId || '__none__';
      if (!byId.has(key)) {
        byId.set(key, {
          category: report.category,
          items: [],
        });
      }
      byId.get(key)!.items.push(report);
    }
    for (const g of byId.values()) {
      g.items.sort((a, b) => b.createDate.localeCompare(a.createDate));
    }
    return [...byId.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .filter(g => g.items.length > 0)
      .sort((a, b) => {
        const ao = a.category?.sortOrder ?? 9999;
        const bo = b.category?.sortOrder ?? 9999;
        if (ao !== bo) return ao - bo;
        const an = a.category?.name ?? 'Без категории';
        const bn = b.category?.name ?? 'Без категории';
        return an.localeCompare(bn, 'ru');
      });
  }, [categories, reports]);

  const selected = reports.find(r => r.id === selectedId) ?? null;

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setStatus = async (report: IBugReport, status: BugReportStatus) => {
    if (report.status === status) return;
    setUpdatingId(report.id);
    try {
      await updateBugReportStatus(report.id, status);
      setReports(prev =>
        prev.map(r => (r.id === report.id ? { ...r, status, updateDate: new Date().toISOString() } : r)),
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Не удалось обновить статус');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error) return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      <div className={`${styles.listPane} ${selected ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Багрепорты</h2>
          <div className={reportStyles.filterWrap}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        <div className={styles.itemList}>
          {groups.length === 0 && (
            <div className={styles.groupEmpty}>Сообщений об ошибках пока нет</div>
          )}
          {groups.map(group => {
            const open = expanded.has(group.id);
            const pendingCount = group.items.filter(i => i.status === 'Pending').length;
            const title = group.category?.name ?? 'Без категории';
            return (
              <div key={group.id} className={styles.itemGroup}>
                <div
                  className={styles.categoryRow}
                  onClick={() => toggleGroup(group.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(group.id);
                    }
                  }}
                >
                  <button
                    type="button"
                    className={styles.expandBtn}
                    aria-label={open ? 'Свернуть' : 'Развернуть'}
                    onClick={e => {
                      e.stopPropagation();
                      toggleGroup(group.id);
                    }}
                  >
                    {open ? '▾' : '▸'}
                  </button>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{title}</span>
                    <span className={styles.itemSub}>
                      {group.items.length} сообщ.
                      {pendingCount > 0 ? ` · ${pendingCount} в ожидании` : ''}
                    </span>
                  </div>
                </div>

                {open && (
                  <div className={styles.typesList}>
                    {group.items.length === 0 ? (
                      <div className={styles.groupEmpty}>Нет сообщений</div>
                    ) : (
                      group.items.map(report => (
                        <div
                          key={report.id}
                          className={`${styles.typeRow} ${selectedId === report.id ? styles.listRowActive : ''}`}
                          onClick={() => setSelectedId(report.id)}
                        >
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>
                              {report.description.slice(0, 80) || 'Без описания'}
                              {report.description.length > 80 ? '…' : ''}
                            </span>
                            <span className={styles.itemSub}>
                              {report.reporter?.login || 'пользователь'} · {formatDateTime(report.createDate)}
                            </span>
                          </div>
                          <span className={`${reportStyles.statusChip} ${statusClass(report.status)}`}>
                            {BUG_REPORT_STATUS_LABELS[report.status]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${styles.formPane} ${!selected ? styles.mobileHidden : ''}`}>
        <button type="button" className={styles.mobileBackBtn} onClick={() => setSelectedId(null)}>
          ← Назад к списку
        </button>
        {selected ? (
          <ReportDetails
            report={selected}
            busy={updatingId === selected.id}
            onResolved={() => void setStatus(selected, 'Resolved')}
            onCancelled={() => void setStatus(selected, 'Cancelled')}
            onPending={() => void setStatus(selected, 'Pending')}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите сообщение для просмотра</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDetails({
  report,
  busy,
  onResolved,
  onCancelled,
  onPending,
}: {
  report: IBugReport;
  busy: boolean;
  onResolved: () => void;
  onCancelled: () => void;
  onPending: () => void;
}) {
  return (
    <div className={`${styles.form} ${reportStyles.detail}`}>
      <h3 className={styles.formTitle}>Сообщение об ошибке</h3>

      <div className={reportStyles.metaGrid}>
        <div>
          <div className={styles.label}>Статус</div>
          <span className={`${reportStyles.statusChip} ${statusClass(report.status)}`}>
            {BUG_REPORT_STATUS_LABELS[report.status]}
          </span>
        </div>
        <div>
          <div className={styles.label}>Категория</div>
          <div className={reportStyles.metaValue}>
            {report.category?.name ?? '—'}
          </div>
        </div>
        <div>
          <div className={styles.label}>Автор</div>
          <div className={reportStyles.metaValue}>
            {report.reporter?.login || report.reporterAccountId || '—'}
          </div>
        </div>
        <div>
          <div className={styles.label}>Создано</div>
          <div className={reportStyles.metaValue}>{formatDateTime(report.createDate)}</div>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Описание</span>
        <p className={reportStyles.description}>{report.description || '—'}</p>
      </div>

      {report.fileIds.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>Скриншоты</span>
          <div className={reportStyles.shots}>
            {report.fileIds.map(id => (
              <button
                key={id}
                type="button"
                className={reportStyles.shot}
                title="Открыть"
                onClick={() => {
                  void fetchAuthedImage(id, { fullSize: true })
                    .then(url => window.open(url, '_blank', 'noopener,noreferrer'))
                    .catch(err => {
                      window.alert(err instanceof Error ? err.message : 'Не удалось открыть файл');
                    });
                }}
              >
                <AuthImage
                  fileId={id}
                  alt="Скриншот"
                  className={reportStyles.shotImg}
                  imageFit="cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.formActions}>
        {report.status !== 'Pending' && (
          <button type="button" className={styles.cancelBtn} onClick={onPending} disabled={busy}>
            Вернуть в ожидание
          </button>
        )}
        {report.status !== 'Cancelled' && (
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancelled}
            disabled={busy}
          >
            Отменено
          </button>
        )}
        {report.status !== 'Resolved' && (
          <button type="button" className={styles.saveBtn} onClick={onResolved} disabled={busy}>
            {busy ? '...' : 'Готово'}
          </button>
        )}
      </div>
    </div>
  );
}
