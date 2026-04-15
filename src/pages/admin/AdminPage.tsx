// pages/admin/AdminPage.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  categoriesApi, typesApi, contactTypesApi,
  type IEventCategory, type IEventType, type IContactType,
  type IEventCategoryRequest, type IEventTypeRequest, type IContactTypeRequest,
} from '@/entities/admin/adminApi';
import styles from './AdminPage.module.css';

type AdminTab = 'eventTypes' | 'contactTypes';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('eventTypes');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>⚙️ Администрирование</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'eventTypes' ? styles.tabActive : ''}`}
          onClick={() => setTab('eventTypes')}
        >
          Типы мероприятий
        </button>
        <button
          className={`${styles.tab} ${tab === 'contactTypes' ? styles.tabActive : ''}`}
          onClick={() => setTab('contactTypes')}
        >
          Типы контактов
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'eventTypes' && <EventTypesTab />}
        {tab === 'contactTypes' && <ContactTypesTab />}
      </div>
    </div>
  );
}

// =============================================================================
// ВКЛАДКА: Типы мероприятий (категории + типы)
// =============================================================================

function EventTypesTab() {
  const [categories, setCategories] = useState<IEventCategory[]>([]);
  const [types,      setTypes]      = useState<IEventType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Какая категория раскрыта для просмотра типов
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Редактируемая категория / тип (null = форма создания)
  const [editingCat,  setEditingCat]  = useState<IEventCategory | null | 'new'>(null);
  const [editingType, setEditingType] = useState<IEventType | null | 'new'>(null);
  // Категория, к которой добавляем тип
  const [newTypeCatId, setNewTypeCatId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, tps] = await Promise.all([categoriesApi.getAll(), typesApi.getAll()]);
      setCategories(cats);
      setTypes(tps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const typesForCat = (catId: string) => types.filter(t => t.eventCategoryId === catId);

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error)   return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      {/* ---- Левая панель: категории ---- */}
      <div className={styles.listPane}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Категории</h2>
          <button className={styles.addBtn} onClick={() => setEditingCat('new')}>+ Добавить</button>
        </div>

        <div className={styles.itemList}>
          {categories.map(cat => (
            <div key={cat.id} className={styles.itemGroup}>
              <div
                className={`${styles.categoryRow} ${expandedCat === cat.id ? styles.categoryRowActive : ''}`}
              >
                <button
                  className={styles.expandBtn}
                  onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                  title={expandedCat === cat.id ? 'Свернуть' : 'Развернуть'}
                >
                  {expandedCat === cat.id ? '▾' : '▸'}
                </button>
                <div className={styles.itemInfo} onClick={() => setEditingCat(cat)}>
                  <span className={styles.itemName}>{cat.name}</span>
                  <span className={styles.itemSub}>{cat.localizationPath}</span>
                </div>
                <div className={styles.itemActions}>
                  <button className={styles.iconBtn} onClick={() => setEditingCat(cat)} title="Редактировать">✏️</button>
                  <button
                    className={`${styles.iconBtn} ${styles.dangerBtn}`}
                    onClick={async () => {
                      if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
                      await categoriesApi.delete(cat.id);
                      load();
                    }}
                    title="Удалить"
                  >🗑️</button>
                </div>
              </div>

              {/* Типы категории */}
              {expandedCat === cat.id && (
                <div className={styles.typesList}>
                  {typesForCat(cat.id).map(tp => (
                    <div key={tp.id} className={styles.typeRow}>
                      <div className={styles.itemInfo} onClick={() => setEditingType(tp)}>
                        <span className={styles.itemName}>{tp.name}</span>
                        <span className={styles.itemSub}>{tp.localizationPath}</span>
                      </div>
                      <div className={styles.itemActions}>
                        <button className={styles.iconBtn} onClick={() => setEditingType(tp)} title="Редактировать">✏️</button>
                        <button
                          className={`${styles.iconBtn} ${styles.dangerBtn}`}
                          onClick={async () => {
                            if (!confirm(`Удалить тип «${tp.name}»?`)) return;
                            await typesApi.delete(tp.id);
                            load();
                          }}
                          title="Удалить"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}
                  <button
                    className={styles.addTypeBtn}
                    onClick={() => { setNewTypeCatId(cat.id); setEditingType('new'); }}
                  >
                    + Добавить тип
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Правая панель: форма редактирования ---- */}
      <div className={styles.formPane}>
        {editingCat !== null && (
          <CategoryForm
            category={editingCat === 'new' ? null : editingCat}
            onSave={async (data) => {
              if (editingCat === 'new') {
                await categoriesApi.create(data);
              } else {
                await categoriesApi.update(editingCat.id, data);
              }
              setEditingCat(null);
              load();
            }}
            onCancel={() => setEditingCat(null)}
          />
        )}

        {editingType !== null && (
          <TypeForm
            type={editingType === 'new' ? null : editingType}
            categories={categories}
            defaultCategoryId={newTypeCatId}
            onSave={async (data) => {
              if (editingType === 'new') {
                await typesApi.create(data);
              } else {
                await typesApi.update(editingType.id, data);
              }
              setEditingType(null);
              setNewTypeCatId(null);
              load();
            }}
            onCancel={() => { setEditingType(null); setNewTypeCatId(null); }}
          />
        )}

        {editingCat === null && editingType === null && (
          <div className={styles.emptyForm}>
            <span>👆</span>
            <p>Выберите категорию или тип для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Форма категории ----

function CategoryForm({
  category, onSave, onCancel,
}: {
  category: IEventCategory | null;
  onSave: (data: IEventCategoryRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IEventCategoryRequest>({
    name:             category?.name             ?? '',
    localizationPath: category?.localizationPath ?? '',
    description:      category?.description      ?? '',
    ico:              category?.ico              ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const set = (key: keyof IEventCategoryRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Укажите название'); return; }
    setSaving(true); setErr(null);
    try { await onSave(form); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{category ? 'Редактировать категорию' : 'Новая категория'}</h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Название *">
        <input className={styles.input} value={form.name} onChange={set('name')} placeholder="Музыка" />
      </FormField>
      <FormField label="Путь локализации *">
        <input className={styles.input} value={form.localizationPath} onChange={set('localizationPath')} placeholder="music" />
      </FormField>
      <FormField label="Описание">
        <textarea className={styles.textarea} rows={3} value={form.description ?? ''} onChange={set('description')} placeholder="Описание категории..." />
      </FormField>
      <FormField label="Иконка (URL или emoji)">
        <input className={styles.input} value={form.ico ?? ''} onChange={set('ico')} placeholder="🎵" />
      </FormField>
      <div className={styles.formActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ---- Форма типа ----

function TypeForm({
  type, categories, defaultCategoryId, onSave, onCancel,
}: {
  type: IEventType | null;
  categories: IEventCategory[];
  defaultCategoryId: string | null;
  onSave: (data: IEventTypeRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IEventTypeRequest>({
    name:             type?.name             ?? '',
    localizationPath: type?.localizationPath ?? '',
    description:      type?.description      ?? '',
    ico:              type?.ico              ?? '',
    eventCategoryId:  type?.eventCategoryId  ?? defaultCategoryId ?? (categories[0]?.id ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const set = (key: keyof IEventTypeRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim())             { setErr('Укажите название'); return; }
    if (!form.eventCategoryId)         { setErr('Выберите категорию'); return; }
    setSaving(true); setErr(null);
    try { await onSave(form); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{type ? 'Редактировать тип' : 'Новый тип мероприятия'}</h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Категория *">
        <select className={styles.input} value={form.eventCategoryId} onChange={set('eventCategoryId')}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FormField>
      <FormField label="Название *">
        <input className={styles.input} value={form.name} onChange={set('name')} placeholder="Концерт" />
      </FormField>
      <FormField label="Путь локализации *">
        <input className={styles.input} value={form.localizationPath} onChange={set('localizationPath')} placeholder="music.concert" />
      </FormField>
      <FormField label="Описание">
        <textarea className={styles.textarea} rows={3} value={form.description ?? ''} onChange={set('description')} placeholder="Описание типа..." />
      </FormField>
      <FormField label="Иконка (URL или emoji)">
        <input className={styles.input} value={form.ico ?? ''} onChange={set('ico')} placeholder="🎤" />
      </FormField>
      <div className={styles.formActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ВКЛАДКА: Типы контактов
// =============================================================================

function ContactTypesTab() {
  const [items,   setItems]   = useState<IContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [editing, setEditing] = useState<IContactType | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await contactTypesApi.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error)   return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      {/* ---- Список ---- */}
      <div className={styles.listPane}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Типы контактов</h2>
          <button className={styles.addBtn} onClick={() => setEditing('new')}>+ Добавить</button>
        </div>
        <div className={styles.itemList}>
          {items.map(item => (
            <div key={item.id} className={styles.categoryRow}>
              <div className={styles.itemInfo} onClick={() => setEditing(item)}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemSub}>{item.mask ?? item.localizationPath}</span>
              </div>
              <div className={styles.itemMeta}>
                {item.allowNotifications && <span className={styles.tag}>уведомления</span>}
              </div>
              <div className={styles.itemActions}>
                <button className={styles.iconBtn} onClick={() => setEditing(item)} title="Редактировать">✏️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Форма ---- */}
      <div className={styles.formPane}>
        {editing !== null ? (
          <ContactTypeForm
            item={editing === 'new' ? null : editing}
            onSave={async (data) => {
              if (editing === 'new') {
                await contactTypesApi.create(data);
              } else {
                await contactTypesApi.update(editing.id, data);
              }
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <span>👆</span>
            <p>Выберите тип контакта для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Форма типа контакта ----

function ContactTypeForm({
  item, onSave, onCancel,
}: {
  item: IContactType | null;
  onSave: (data: IContactTypeRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IContactTypeRequest>({
    name:               item?.name               ?? '',
    localizationPath:   item?.localizationPath   ?? '',
    description:        item?.description        ?? '',
    mask:               item?.mask               ?? '',
    allowNotifications: item?.allowNotifications ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const set = (key: keyof IContactTypeRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({
        ...f,
        [key]: e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value,
      }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Укажите название'); return; }
    setSaving(true); setErr(null);
    try { await onSave(form); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{item ? 'Редактировать тип контакта' : 'Новый тип контакта'}</h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Название *">
        <input className={styles.input} value={form.name} onChange={set('name')} placeholder="Email" />
      </FormField>
      <FormField label="Путь локализации *">
        <input className={styles.input} value={form.localizationPath} onChange={set('localizationPath')} placeholder="email" />
      </FormField>
      <FormField label="Описание">
        <textarea className={styles.textarea} rows={2} value={form.description ?? ''} onChange={set('description')} placeholder="Описание..." />
      </FormField>
      <FormField label="Маска ввода">
        <input className={styles.input} value={form.mask ?? ''} onChange={set('mask')} placeholder="+7(###)###-##-##" />
      </FormField>
      <label className={styles.checkboxLabel}>
        <input type="checkbox" checked={form.allowNotifications} onChange={set('allowNotifications')} />
        Разрешить уведомления
      </label>
      <div className={styles.formActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ---- Общий компонент поля ----

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
