// pages/admin/AdminPage.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  categoriesApi, typesApi, contactTypesApi,
  type IEventCategory, type IEventType, type IContactType,
  type IEventCategoryRequest, type IEventTypeRequest, type IContactTypeRequest,
  tariffApi, tariffValidatorApi,
  type ITariff, type ITariffValidator, type ITariffPeriod, type ITariffRequest,
} from '@/entities/admin/adminApi';
import { Select } from '@/shared/ui/Select/Select';
import styles from './AdminPage.module.css';

type AdminTab = 'eventTypes' | 'contactTypes' | 'tariffs';

// Восстанавливаем data URL из чистого base64 для отображения иконки
function icoToDisplayUrl(ico: string): string {
  if (!ico) return '';
  if (ico.startsWith('data:') || ico.startsWith('http') || ico.startsWith('/') || ico.length < 10) return ico;
  const mime = (ico.startsWith('PHN') || ico.startsWith('PD9') || ico.startsWith('PD94'))
    ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${ico}`;
}

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
        <button
          className={`${styles.tab} ${tab === 'tariffs' ? styles.tabActive : ''}`}
          onClick={() => setTab('tariffs')}
        >
          Тарифы
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'eventTypes'   && <EventTypesTab />}
        {tab === 'contactTypes' && <ContactTypesTab />}
        {tab === 'tariffs'      && <TariffsTab />}
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

  const isEditing = editingCat !== null || editingType !== null;

  return (
    <div className={styles.splitPane}>
      {/* ---- Левая панель: категории ---- */}
      <div className={`${styles.listPane} ${isEditing ? styles.mobileHidden : ''}`}>
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
                <div className={styles.itemInfo} onClick={() => { setEditingCat(cat); setEditingType(null); setNewTypeCatId(null); }}>
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
                      <div className={styles.itemInfo} onClick={() => { setEditingType(tp); setEditingCat(null); }}>
                        {tp.ico && (
                          icoToDisplayUrl(tp.ico).startsWith('data:') || icoToDisplayUrl(tp.ico).startsWith('http')
                            ? <img src={icoToDisplayUrl(tp.ico)} alt="" className="event-type-ico" style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                            : <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{tp.ico}</span>
                        )}
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
      <div className={`${styles.formPane} ${!isEditing ? styles.mobileHidden : ''}`}>
        {/* Кнопка «Назад» только на мобиле */}
        <button className={styles.mobileBackBtn}
          onClick={() => { setEditingCat(null); setEditingType(null); setNewTypeCatId(null); }}>
          ← Назад к списку
        </button>
        {editingCat !== null && (
          <CategoryForm
            key={editingCat === 'new' ? 'new-cat' : editingCat.id}
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
            key={editingType === 'new' ? 'new-type' : editingType.id}
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
    color:            category?.color            ?? '',
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
      <FormField label="Цвет категории">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={form.color || '#6366f1'}
            onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            style={{ width: 40, height: 36, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'none' }}
          />
          <input
            className={styles.input}
            value={form.color ?? ''}
            onChange={e => setForm(f => ({ ...f, color: e.target.value || null }))}
            placeholder="#6366f1 (или оставьте пустым)"
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          {form.color && (
            <button type="button"
              style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setForm(f => ({ ...f, color: null }))}>
              Сбросить
            </button>
          )}
        </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof IEventTypeRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  // Конвертируем файл — сохраняем только чистый base64 без data: префикса
  const icoMimeRef = useRef<string>('image/png');
  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024) { setErr('Иконка слишком большая (макс. 100 КБ)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      icoMimeRef.current = dataUrl.split(';')[0].replace('data:', '') || 'image/png';
      // Бэкенд ожидает только чистый base64 без "data:image/...;base64," префикса
      const base64 = dataUrl.split(',')[1] ?? dataUrl;
      setForm(f => ({ ...f, ico: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim())     { setErr('Укажите название'); return; }
    if (!form.eventCategoryId) { setErr('Выберите категорию'); return; }
    setSaving(true); setErr(null);
    try { await onSave(form); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  // Для превью восстанавливаем data URL из чистого base64
  const toDisplayUrl = (ico: string): string => {
    if (ico.startsWith('data:') || ico.startsWith('http') || ico.startsWith('/')) return ico;
    // PHN = SVG в base64, /9j = JPEG, iVB = PNG
    const mime = icoMimeRef.current ||
      (ico.startsWith('PHN') || ico.startsWith('PD9') ? 'image/svg+xml' : 'image/png');
    return `data:${mime};base64,${ico}`;
  };

  const icoPreview = form.ico
    ? (() => {
        const url = toDisplayUrl(form.ico);
        return (url.startsWith('data:') || url.startsWith('http'))
          ? <img src={url} alt="icon" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
          : <span style={{ fontSize: 28, lineHeight: 1 }}>{form.ico}</span>;
      })()
    : null;

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{type ? 'Редактировать тип' : 'Новый тип мероприятия'}</h3>
      {err && <div className={styles.formError}>{err}</div>}
      <FormField label="Категория *">
        <Select
        value={form.eventCategoryId}
        onChange={v => set('eventCategoryId')({ target: { value: v } } as any)}
        placeholder="Выберите категорию"
        options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
      />
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
      <FormField label="Иконка">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Превью / заглушка */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 56, height: 56, borderRadius: 10, flexShrink: 0,
              background: 'var(--surface-2)', border: '1px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
            title="Нажмите чтобы загрузить изображение"
          >
            {icoPreview ?? <span style={{ fontSize: 22, opacity: 0.4 }}>🖼</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className={styles.cancelBtn}
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {form.ico ? 'Заменить файл' : 'Загрузить файл'}
            </button>
            <input
              className={styles.input}
              style={{ fontSize: 12, padding: '5px 10px' }}
              value={form.ico?.startsWith('data:') ? '' : (form.ico ?? '')}
              onChange={set('ico')}
              placeholder="или вставьте URL / эмодзи"
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleIconFile}
        />
        {form.ico && (
          <button
            type="button"
            style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setForm(f => ({ ...f, ico: '' }))}
          >
            Удалить иконку
          </button>
        )}
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
      <div className={`${styles.listPane} ${editing !== null ? styles.mobileHidden : ''}`}>
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
      <div className={`${styles.formPane} ${editing === null ? styles.mobileHidden : ''}`}>
        <button className={styles.mobileBackBtn} onClick={() => setEditing(null)}>
          ← Назад к списку
        </button>
        {editing !== null ? (
          <ContactTypeForm
            key={editing === 'new' ? 'new-contact' : (editing as IContactType).id}
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

// =============================================================================
// ВКЛАДКА: Тарифы
// =============================================================================

function TariffsTab() {
  const [tariffs, setTariffs]   = useState<ITariff[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [editing, setEditing]   = useState<ITariff | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTariffs(await tariffApi.getAll()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error)   return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      {/* Список */}
      <div className={`${styles.listPane} ${editing !== null ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Тарифы</h2>
          <button className={styles.addBtn} onClick={() => setEditing('new')}>+ Добавить</button>
        </div>
        <div className={styles.itemList}>
          {tariffs.length === 0 && (
            <div className={styles.emptyForm} style={{ minHeight: 120 }}>
              <span style={{ fontSize: 28 }}>📋</span>
              <p>Нет тарифов. Создайте первый.</p>
            </div>
          )}
          {tariffs.map(t => (
            <div key={t.id} className={styles.categoryRow}
              onClick={() => setEditing(t)} style={{ cursor: 'pointer' }}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{t.name}</span>
                <span className={styles.itemSub}>
                  {t.cost === 0 ? 'Бесплатно' : `${t.cost.toLocaleString('ru-RU')} ₽`}
                  {' · '}
                  {formatPeriod(t)}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button className={styles.iconBtn} onClick={e => { e.stopPropagation(); setEditing(t); }}>✏️</button>
                <button
                  className={`${styles.iconBtn} ${styles.dangerBtn}`}
                  title="Удалить тариф"
                  onClick={async e => {
                    e.stopPropagation();
                    if (!confirm(`Удалить тариф «${t.name}»? Это также удалит его валидатор.`)) return;
                    try {
                      // Сначала удаляем валидатор, затем тариф
                      if (t.validatorId) await tariffValidatorApi.delete(t.validatorId);
                      await tariffApi.delete(t.id);
                      if (editing !== 'new' && (editing as ITariff)?.id === t.id) setEditing(null);
                      load();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Ошибка удаления');
                    }
                  }}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Форма */}
      <div className={`${styles.formPane} ${editing === null ? styles.mobileHidden : ''}`}>
        <button className={styles.mobileBackBtn} onClick={() => setEditing(null)}>
          ← Назад к списку
        </button>
        {editing !== null ? (
          <TariffForm
            key={editing === 'new' ? 'new-tariff' : (editing as ITariff).id}
            tariff={editing === 'new' ? null : editing}
            onSave={async (validatorData, tariffData) => {
              if (editing === 'new') {
                // 1. Создаём валидатор
                const validatorId = await tariffValidatorApi.create(validatorData);
                // 2. Создаём тариф с validatorId
                await tariffApi.create({ ...tariffData, validatorId });
              } else {
                // Обновляем валидатор отдельным запросом
                if (editing.validatorId) {
                  await tariffValidatorApi.update({ ...validatorData, id: editing.validatorId });
                }
                // Обновляем тариф — только нужные поля, без tariffValidator
                await tariffApi.update({
                  id:          editing.id,
                  name:        tariffData.name,
                  cost:        tariffData.cost,
                  periodDays:  tariffData.periodDays,
                  validatorId: editing.validatorId,
                } as any);
              }
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <span>👆</span>
            <p>Выберите тариф для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Форма тарифа ----

const EMPTY_VALIDATOR_STR = {
  costLimit: '', personsLimit: '', ageLimit: '',
  maxEventsCount: '', createDateMaxPeriod: '',
  allowPrivate: false, allowGenderSegregation: false, allowMultidaysEvent: false,
};

function TariffForm({ tariff, onSave, onCancel }: {
  tariff: ITariff | null;
  onSave: (v: ITariffValidator, t: ITariffRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,  setName]  = useState(tariff?.name ?? '');
  const [cost,  setCost]  = useState(String(tariff?.cost ?? 0));
  const [days,  setDays]  = useState(String((tariff as any)?.periodDays ?? 30));

  const [validatorStr, setValidatorStr] = useState(EMPTY_VALIDATOR_STR);
  const [loadingV,  setLoadingV]  = useState(!!tariff?.validatorId);

  // Сбрасываем и перезагружаем при смене тарифа
  useEffect(() => {
    setName(tariff?.name ?? '');
    setCost(String(tariff?.cost ?? 0));
    setDays(String((tariff as any)?.periodDays ?? 30));
    setValidatorStr(EMPTY_VALIDATOR_STR);
    setErr(null);

    if (!tariff?.validatorId) { setLoadingV(false); return; }
    setLoadingV(true);
    tariffValidatorApi.getByTariff(tariff.id).then(v => {
      if (v) {
        setValidatorStr({
          costLimit:           v.costLimit    ? String(v.costLimit)    : '',
          personsLimit:        v.personsLimit ? String(v.personsLimit) : '',
          ageLimit:            v.ageLimit     ? String(v.ageLimit)     : '',
          maxEventsCount:      v.maxEventsCount      != null ? String(v.maxEventsCount)      : '',
          createDateMaxPeriod: v.createDateMaxPeriod != null ? String(v.createDateMaxPeriod) : '',
          allowPrivate:            !!v.allowPrivate,
          allowGenderSegregation:  !!v.allowGenderSegregation,
          allowMultidaysEvent:     !!v.allowMultidaysEvent,
        });
      }
    }).finally(() => setLoadingV(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tariff?.id]);

  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setErr('Укажите название'); return; }
    setSaving(true); setErr(null);
    const validator: ITariffValidator = {
      costLimit:              validatorStr.costLimit           !== '' ? parseFloat(validatorStr.costLimit)           : null as any,
      personsLimit:           validatorStr.personsLimit        !== '' ? parseInt(validatorStr.personsLimit)          : null as any,
      ageLimit:               validatorStr.ageLimit            !== '' ? parseInt(validatorStr.ageLimit)              : null as any,
      maxEventsCount:         validatorStr.maxEventsCount      !== '' ? parseInt(validatorStr.maxEventsCount)        : null,
      createDateMaxPeriod:    validatorStr.createDateMaxPeriod !== '' ? parseInt(validatorStr.createDateMaxPeriod)   : null,
      allowPrivate:           validatorStr.allowPrivate,
      allowGenderSegregation: validatorStr.allowGenderSegregation,
      allowMultidaysEvent:    validatorStr.allowMultidaysEvent,
    };
    try {
      await onSave(validator, {
        name, cost: parseFloat(cost) || 0,
        periodDays: parseInt(days) || 30,
        validatorId: '',
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally { setSaving(false); }
  };

  if (loadingV) return <div className={styles.loader}>Загрузка валидатора...</div>;

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>{tariff ? 'Редактировать тариф' : 'Новый тариф'}</h3>
      {err && <div className={styles.formError}>{err}</div>}

      <div className={styles.field}>
        <label className={styles.label}>Название *</label>
        <input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Базовый / Pro / Enterprise..." />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Стоимость (₽/период)</label>
        <input className={styles.input} type="number" min={0} value={cost} onChange={e => setCost(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Период действия (дней)</label>
        <input className={styles.input} type="number" min={1} value={days}
          onChange={e => setDays(e.target.value)} placeholder="30" />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ограничения тарифа
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Макс. стоимость события (₽, пусто = без ограничений)</label>
          <input className={styles.input} type="number" min={0}
            value={validatorStr.costLimit} placeholder="не задано"
            onChange={e => setValidatorStr(v => ({ ...v, costLimit: e.target.value }))} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Макс. участников события (пусто = без ограничений)</label>
          <input className={styles.input} type="number" min={0}
            value={validatorStr.personsLimit} placeholder="не задано"
            onChange={e => setValidatorStr(v => ({ ...v, personsLimit: e.target.value }))} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Макс. возрастное ограничение (пусто = без ограничений)</label>
          <input className={styles.input} type="number" min={0} max={99}
            value={validatorStr.ageLimit} placeholder="не задано"
            onChange={e => setValidatorStr(v => ({ ...v, ageLimit: e.target.value }))} />
        </div>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={validatorStr.allowPrivate}
            onChange={e => setValidatorStr(v => ({ ...v, allowPrivate: e.target.checked }))} />
          Разрешить приватные события
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={validatorStr.allowGenderSegregation}
            onChange={e => setValidatorStr(v => ({ ...v, allowGenderSegregation: e.target.checked }))} />
          Разрешить ограничение по полу
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={validatorStr.allowMultidaysEvent}
            onChange={e => setValidatorStr(v => ({ ...v, allowMultidaysEvent: e.target.checked }))} />
          Разрешить многодневные события
        </label>
        <div className={styles.field}>
          <label className={styles.label}>Макс. кол-во активных событий (пусто = без ограничений)</label>
          <input className={styles.input} type="number" min={0}
            value={validatorStr.maxEventsCount} placeholder="не задано"
            onChange={e => setValidatorStr(v => ({ ...v, maxEventsCount: e.target.value }))} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Макс. дней до начала события (пусто = без ограничений)</label>
          <input className={styles.input} type="number" min={1}
            value={validatorStr.createDateMaxPeriod} placeholder="не задано"
            onChange={e => setValidatorStr(v => ({ ...v, createDateMaxPeriod: e.target.value }))} />
        </div>
      </div>

      <div className={styles.formActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// Форматирование периода
function formatPeriod(t: ITariff): string {
  const days = (t as any).periodDays ?? t.period?.days;
  return days ? `${days} дн.` : '—';
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
