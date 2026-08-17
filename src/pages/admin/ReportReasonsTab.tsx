// pages/admin/ReportReasonsTab.tsx

import { useCallback, useEffect, useState } from 'react';
import {
  REPORT_QUEUE_LABELS,
  REPORT_SEVERITY_LABELS,
  REPORT_TARGET_SCOPE_LABELS,
  ReportQueue,
  ReportSeverity,
  ReportTargetScope,
  createReportReason,
  deleteReportReason,
  fetchReportReasons,
  setReportReasonActive,
  updateReportReason,
  type IReportReason,
  type IUpdateReportReasonRequest,
  type ReportQueueValue,
  type ReportSeverityValue,
  type ReportTargetScopeValue,
} from '@/entities/contentReport';
import { Select } from '@/shared/ui/Select/Select';
import styles from './AdminPage.module.css';

const CODE_RE = /^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/;

const SCOPE_OPTIONS = Object.values(ReportTargetScope).map(value => ({
  value,
  label: REPORT_TARGET_SCOPE_LABELS[value],
}));

const SEVERITY_OPTIONS = Object.values(ReportSeverity).map(value => ({
  value,
  label: REPORT_SEVERITY_LABELS[value],
}));

const QUEUE_OPTIONS = Object.values(ReportQueue).map(value => ({
  value,
  label: REPORT_QUEUE_LABELS[value],
}));

function slugifyCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

export function ReportReasonsTab() {
  const [items, setItems] = useState<IReportReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<IReportReason | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchReportReasons({ onlyActive: false }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editingId = editing && editing !== 'new' ? editing.id : null;

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error) return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      <div className={`${styles.listPane} ${editing !== null ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Причины жалоб</h2>
          <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
            + Добавить
          </button>
        </div>
        <div className={styles.itemList}>
          {items.length === 0 && (
            <div className={styles.groupEmpty}>Причин пока нет</div>
          )}
          {items.map(item => (
            <div
              key={item.id}
              className={`${styles.categoryRow} ${editingId === item.id ? styles.listRowActive : ''}`}
            >
              <div className={styles.itemInfo} onClick={() => setEditing(item)}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemSub}>
                  {item.code}
                  {' · '}
                  {REPORT_TARGET_SCOPE_LABELS[item.targetScope]}
                  {' · '}
                  {REPORT_SEVERITY_LABELS[item.severity]}
                  {' · '}
                  {REPORT_QUEUE_LABELS[item.primaryQueue]}
                </span>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.tag}>{item.active ? 'активна' : 'выкл.'}</span>
              </div>
              <div className={styles.itemActions}>
                <EditIconBtn onClick={() => setEditing(item)} />
                <DeleteIconBtn
                  onClick={async e => {
                    e.stopPropagation();
                    if (!window.confirm(`Удалить причину «${item.name}»?`)) return;
                    try {
                      await deleteReportReason(item.id);
                      if (editingId === item.id) setEditing(null);
                      await load();
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Не удалось удалить';
                      const deactivate = window.confirm(
                        `${msg}\n\nЕсли на причину уже есть жалобы, её нельзя удалить. Деактивировать?`,
                      );
                      if (!deactivate) return;
                      try {
                        await setReportReasonActive(item.id, false);
                        if (editingId === item.id) setEditing({ ...item, active: false });
                        await load();
                      } catch (deactErr) {
                        window.alert(
                          deactErr instanceof Error ? deactErr.message : 'Не удалось деактивировать',
                        );
                      }
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.formPane} ${editing === null ? styles.mobileHidden : ''}`}>
        <button type="button" className={styles.mobileBackBtn} onClick={() => setEditing(null)}>
          ← Назад к списку
        </button>
        {editing !== null ? (
          <ReasonForm
            key={editing === 'new' ? 'new-reason' : (editing as IReportReason).id}
            item={editing === 'new' ? null : editing}
            onSave={async data => {
              if (editing === 'new') {
                const id = await createReportReason({
                  code: data.code,
                  name: data.name,
                  description: data.description,
                  targetScope: data.targetScope,
                  severity: data.severity,
                  primaryQueue: data.primaryQueue,
                  sortOrder: data.sortOrder,
                });
                if (!data.active) {
                  await setReportReasonActive(id, false);
                }
              } else {
                await updateReportReason(editing.id, data);
              }
              setEditing(null);
              await load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите причину для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReasonForm({
  item,
  onSave,
  onCancel,
}: {
  item: IReportReason | null;
  onSave: (data: IUpdateReportReasonRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IUpdateReportReasonRequest>({
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    targetScope: item?.targetScope ?? ReportTargetScope.Both,
    severity: item?.severity ?? ReportSeverity.Community,
    primaryQueue: item?.primaryQueue ?? ReportQueue.Organizers,
    sortOrder: item?.sortOrder ?? 0,
    active: item?.active ?? true,
  });
  const [codeTouched, setCodeTouched] = useState(Boolean(item));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setName = (name: string) => {
    setForm(f => ({
      ...f,
      name,
      code: codeTouched ? f.code : slugifyCode(name),
    }));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name) {
      setErr('Укажите название');
      return;
    }
    if (!CODE_RE.test(code)) {
      setErr('Код: латиница, цифры, _ и -, от 2 до 64 символов, начинается с буквы');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        ...form,
        name,
        code,
        description: form.description?.trim() || null,
        sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>
        {item ? 'Редактировать причину' : 'Новая причина'}
      </h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Название *">
        <input
          className={styles.input}
          value={form.name}
          onChange={e => setName(e.target.value)}
          placeholder="Спам"
        />
      </FormField>
      <FormField label="Код *">
        <input
          className={styles.input}
          value={form.code}
          onChange={e => {
            setCodeTouched(true);
            setForm(f => ({ ...f, code: e.target.value }));
          }}
          placeholder="spam"
        />
        <span className={styles.fieldHint}>Латиница, цифры, _ и - · 2–64 символа</span>
      </FormField>
      <FormField label="Описание">
        <textarea
          className={styles.textarea}
          value={form.description ?? ''}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Подсказка пользователю при выборе причины"
          rows={3}
        />
      </FormField>
      <FormField label="Цель">
        <Select
          value={form.targetScope}
          onChange={value => setForm(f => ({ ...f, targetScope: value as ReportTargetScopeValue }))}
          options={SCOPE_OPTIONS}
        />
      </FormField>
      <FormField label="Серьёзность">
        <Select
          value={form.severity}
          onChange={value => setForm(f => ({ ...f, severity: value as ReportSeverityValue }))}
          options={SEVERITY_OPTIONS}
        />
      </FormField>
      <FormField label="Очередь по умолчанию">
        <Select
          value={form.primaryQueue}
          onChange={value => setForm(f => ({ ...f, primaryQueue: value as ReportQueueValue }))}
          options={QUEUE_OPTIONS}
        />
        <span className={styles.fieldHint}>
          Жалобы на мероприятие всегда уходят на площадку, даже если очередь — организаторы.
        </span>
      </FormField>
      <FormField label="Порядок сортировки">
        <input
          className={styles.input}
          type="number"
          value={form.sortOrder}
          onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
        />
      </FormField>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
        />
        Активна (доступна пользователям)
      </label>
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Отмена
        </button>
        <button type="button" className={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function EditIconBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.iconBtn} onClick={onClick} title="Редактировать">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

function DeleteIconBtn({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${styles.dangerBtn}`}
      onClick={onClick}
      title="Удалить"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
