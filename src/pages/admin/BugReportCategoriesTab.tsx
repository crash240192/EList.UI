// pages/admin/BugReportCategoriesTab.tsx

import { useCallback, useEffect, useState } from 'react';
import {
  createBugReportCategory,
  deleteBugReportCategory,
  fetchBugReportCategories,
  setBugReportCategoryActive,
  updateBugReportCategory,
  type IBugReportCategory,
  type IUpdateBugReportCategoryRequest,
} from '@/entities/bugReport';
import styles from './AdminPage.module.css';

function slugifyCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9а-яё\-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function BugReportCategoriesTab() {
  const [items, setItems] = useState<IBugReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<IBugReportCategory | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchBugReportCategories(false));
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
          <h2 className={styles.paneTitle}>Категории ошибок</h2>
          <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
            + Добавить
          </button>
        </div>
        <div className={styles.itemList}>
          {items.length === 0 && (
            <div className={styles.groupEmpty}>Категорий пока нет</div>
          )}
          {items.map(item => (
            <div
              key={item.id}
              className={`${styles.categoryRow} ${editingId === item.id ? styles.listRowActive : ''}`}
            >
              <div className={styles.itemInfo} onClick={() => setEditing(item)}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemSub}>
                  {item.code} · порядок {item.sortOrder}
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
                    if (!window.confirm(`Удалить категорию «${item.name}»?`)) return;
                    try {
                      await deleteBugReportCategory(item.id);
                      if (editingId === item.id) setEditing(null);
                      await load();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : 'Не удалось удалить');
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
          <CategoryForm
            key={editing === 'new' ? 'new-bug-cat' : (editing as IBugReportCategory).id}
            item={editing === 'new' ? null : editing}
            onSave={async data => {
              if (editing === 'new') {
                const id = await createBugReportCategory({
                  code: data.code,
                  name: data.name,
                  sortOrder: data.sortOrder,
                });
                if (!data.active) {
                  await setBugReportCategoryActive(id, false);
                }
              } else {
                await updateBugReportCategory(editing.id, data);
              }
              setEditing(null);
              await load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите категорию для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryForm({
  item,
  onSave,
  onCancel,
}: {
  item: IBugReportCategory | null;
  onSave: (data: IUpdateBugReportCategoryRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IUpdateBugReportCategoryRequest>({
    code: item?.code ?? '',
    name: item?.name ?? '',
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
    if (!form.name.trim()) {
      setErr('Укажите название');
      return;
    }
    if (!form.code.trim()) {
      setErr('Укажите код');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
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
        {item ? 'Редактировать категорию' : 'Новая категория'}
      </h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Название *">
        <input
          className={styles.input}
          value={form.name}
          onChange={e => setName(e.target.value)}
          placeholder="Карта"
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
          placeholder="map"
        />
        <span className={styles.fieldHint}>Латиница/цифры, используется как стабильный идентификатор</span>
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
