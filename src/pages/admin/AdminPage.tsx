// pages/admin/AdminPage.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  categoriesApi, typesApi, contactTypesApi,
  type IEventCategory, type IEventType, type IContactType,
  type IEventCategoryRequest, type IEventTypeRequest, type IContactTypeRequest,
  tariffApi, tariffValidatorApi,
  type ITariff, type ITariffValidator, type ITariffPeriod, type ITariffRequest,
} from '@/entities/admin/adminApi';
import { sortByNameRu } from '@/entities/event/lib/sortByNameRu';
import { Select } from '@/shared/ui/Select/Select';
import { EVENT_AGE_LIMIT_OPTIONS, formatTariffAgeLimitLabel, type EventAgeLimit } from '@/shared/lib/ageLimit';
import { usePageTitle } from '@/shared/hooks';
import { PlatformStaffGate } from '@/features/admin/PlatformStaffGate';
import {
  DOCUMENT_TYPE_LABELS,
  addAgreementDocument,
  fetchLastDocument,
  fetchLastDocuments,
  type DocumentTypeValue,
  type IAgreementDocument,
  type IDocumentRequest,
} from '@/entities/agreement';
import { PlatformRole } from '@/entities/platformRole';
import { usePlatformRoleStore } from '@/app/store';
import { BugReportCategoriesTab } from './BugReportCategoriesTab';
import { BugReportsTab } from './BugReportsTab';
import { ReportReasonsTab } from './ReportReasonsTab';
import { PlatformRolesTab } from './PlatformRolesTab';
import styles from './AdminPage.module.css';

type AdminTab =
  | 'eventTypes'
  | 'contactTypes'
  | 'tariffs'
  | 'agreements'
  | 'bugReports'
  | 'bugReportCategories'
  | 'reportReasons'
  | 'platformRoles';

type AdminNavItem = { key: AdminTab; label: string };

const CONTENT_NAV: AdminNavItem[] = [
  { key: 'eventTypes', label: 'Типы мероприятий' },
  { key: 'contactTypes', label: 'Типы контактов' },
  { key: 'tariffs', label: 'Тарифы' },
  { key: 'agreements', label: 'Соглашения' },
  { key: 'bugReportCategories', label: 'Категории ошибок' },
];

const SYSTEM_NAV: AdminNavItem[] = [
  { key: 'bugReports', label: 'Багрепорты' },
  { key: 'reportReasons', label: 'Причины жалоб' },
  { key: 'platformRoles', label: 'Роли площадки' },
];

const ADMIN_ONLY_TABS = new Set<AdminTab>(['reportReasons', 'platformRoles']);

const VALID_TABS = new Set<AdminTab>([
  'eventTypes',
  'contactTypes',
  'tariffs',
  'agreements',
  'bugReports',
  'bugReportCategories',
  'reportReasons',
  'platformRoles',
]);

function isAdminTab(value: string | null): value is AdminTab {
  return value != null && VALID_TABS.has(value as AdminTab);
}

/** Типы документов на вкладке «Соглашения» (включая OrganizationAgreement и TicketingAgreement) */
const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPE_LABELS;

const VERSION_RE = /^\d+\.\d+\.\d+$/;

/** Следующая patch-версия от текущей (x.x.x → x.x.(x+1)), иначе 1.0.0 */
function suggestNextVersion(current: string | undefined): string {
  if (!current || !VERSION_RE.test(current)) return '1.0.0';
  const [major, minor, patch] = current.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

// Восстанавливаем data URL из чистого base64 для отображения иконки
function icoToDisplayUrl(ico: string): string {
  if (!ico) return '';
  if (ico.startsWith('data:') || ico.startsWith('http') || ico.startsWith('/') || ico.length < 10) return ico;
  const mime = (ico.startsWith('PHN') || ico.startsWith('PD9') || ico.startsWith('PD94'))
    ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${ico}`;
}

export default function AdminPage() {
  usePageTitle('Администрирование');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const platformRole = usePlatformRoleStore(s => s.role);
  const platformActive = usePlatformRoleStore(s => s.active);
  const isAdminOrAbove =
    platformActive
    && (platformRole === PlatformRole.Admin || platformRole === PlatformRole.Superuser);

  if (tabFromUrl === 'moderation') {
    return <Navigate to="/moderation" replace />;
  }

  const initialTab: AdminTab = isAdminTab(tabFromUrl) ? tabFromUrl : 'eventTypes';
  const [tab, setTab] = useState<AdminTab>(initialTab);

  const navSections = useMemo(() => [
    { section: 'Контент', items: CONTENT_NAV },
    {
      section: 'Администрирование',
      items: SYSTEM_NAV.filter(item => isAdminOrAbove || !ADMIN_ONLY_TABS.has(item.key)),
    },
  ], [isAdminOrAbove]);

  const allowedTabs = useMemo(
    () => navSections.flatMap(s => s.items.map(i => i.key)),
    [navSections],
  );

  useEffect(() => {
    if (isAdminTab(tabFromUrl) && allowedTabs.includes(tabFromUrl)) {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl, allowedTabs]);

  useEffect(() => {
    if (allowedTabs.includes(tab)) return;
    setTab(allowedTabs[0] ?? 'eventTypes');
  }, [allowedTabs, tab]);

  const selectTab = (next: AdminTab) => {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'eventTypes') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  const activeTab = allowedTabs.includes(tab) ? tab : (allowedTabs[0] ?? 'eventTypes');

  return (
    <PlatformStaffGate title="Проверка доступа…">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Администрирование</h1>
          <p className={styles.subtitle}>Настройки контента и управление площадкой</p>
        </div>

        <div className={styles.adminLayout}>
          <nav className={styles.snav} aria-label="Разделы администрирования">
            {navSections.map(({ section, items }) => (
              items.length > 0 && (
                <div key={section}>
                  <div className={styles.snavSection}>{section}</div>
                  {items.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.snavItem} ${activeTab === item.key ? styles.snavItemActive : ''}`}
                      onClick={() => selectTab(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )
            ))}
          </nav>

          <div className={styles.content}>
            {activeTab === 'eventTypes'   && <EventTypesTab />}
            {activeTab === 'contactTypes' && <ContactTypesTab />}
            {activeTab === 'tariffs'      && <TariffsTab />}
            {activeTab === 'agreements'   && <AgreementsTab />}
            {activeTab === 'bugReports'   && <BugReportsTab />}
            {activeTab === 'bugReportCategories' && <BugReportCategoriesTab />}
            {activeTab === 'reportReasons' && isAdminOrAbove && <ReportReasonsTab />}
            {activeTab === 'platformRoles' && isAdminOrAbove && <PlatformRolesTab />}
          </div>
        </div>
      </div>
    </PlatformStaffGate>
  );
}

// =============================================================================
// ВКЛАДКА: Типы мероприятий (категории + типы)
// =============================================================================

function sortTariffsByCost(tariffs: ITariff[]): ITariff[] {
  return [...tariffs].sort((a, b) => a.cost - b.cost);
}

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
      setCategories(sortByNameRu(cats));
      setTypes(tps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editingCatId = editingCat && editingCat !== 'new' ? editingCat.id : null;
  const editingTypeId = editingType && editingType !== 'new' ? editingType.id : null;
  const editingTypeCatId = editingType && editingType !== 'new'
    ? editingType.eventCategoryId
    : newTypeCatId;

  useEffect(() => {
    if (editingTypeCatId) setExpandedCat(editingTypeCatId);
  }, [editingTypeCatId]);

  const typesForCat = (catId: string) =>
    sortByNameRu(types.filter(t => t.eventCategoryId === catId));

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
                className={`${styles.categoryRow} ${editingCatId === cat.id ? styles.listRowActive : ''}`}
              >
                <button
                  className={styles.expandBtn}
                  onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                  title={expandedCat === cat.id ? 'Свернуть' : 'Развернуть'}
                >
                  {expandedCat === cat.id ? '▾' : '▸'}
                </button>
                <div className={styles.itemInfo} onClick={() => {
                  setEditingCat(cat);
                  setEditingType(null);
                  setNewTypeCatId(null);
                }}>
                  <span className={styles.itemName}>{cat.name}</span>
                  <span className={styles.itemSub}>{cat.localizationPath}</span>
                </div>
                <div className={styles.itemActions}>
                  <EditIconBtn onClick={() => setEditingCat(cat)} />
                  <DeleteIconBtn
                    onClick={async () => {
                      if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
                      await categoriesApi.delete(cat.id);
                      load();
                    }}
                  />
                </div>
              </div>

              {/* Типы категории */}
              {expandedCat === cat.id && (
                <div className={styles.typesList}>
                  {typesForCat(cat.id).map(tp => (
                    <div
                      key={tp.id}
                      className={`${styles.typeRow} ${editingTypeId === tp.id ? styles.listRowActive : ''}`}
                    >
                      <div className={styles.itemInfo} onClick={() => {
                        setEditingType(tp);
                        setEditingCat(null);
                        setNewTypeCatId(null);
                        setExpandedCat(cat.id);
                      }}>
                        {tp.ico && (
                          icoToDisplayUrl(tp.ico).startsWith('data:') || icoToDisplayUrl(tp.ico).startsWith('http')
                            ? <img src={icoToDisplayUrl(tp.ico)} alt="" className="event-type-ico" style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                            : <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{tp.ico}</span>
                        )}
                        <span className={styles.itemName}>{tp.name}</span>
                        <span className={styles.itemSub}>{tp.localizationPath}</span>
                      </div>
                      <div className={styles.itemActions}>
                        <EditIconBtn onClick={() => {
                          setEditingType(tp);
                          setEditingCat(null);
                          setNewTypeCatId(null);
                          setExpandedCat(cat.id);
                        }} />
                        <DeleteIconBtn
                          onClick={async () => {
                            if (!confirm(`Удалить тип «${tp.name}»?`)) return;
                            await typesApi.delete(tp.id);
                            load();
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    className={styles.addTypeBtn}
                    onClick={() => {
                      setNewTypeCatId(cat.id);
                      setEditingType('new');
                      setExpandedCat(cat.id);
                    }}
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
        <input className={styles.input} value={form.ico ?? ''} onChange={set('ico')} placeholder="https://example.com/icon.png" />
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
        options={sortByNameRu(categories).map(cat => ({ value: cat.id, label: cat.name }))}
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
            {icoPreview ?? <span className={styles.icoPlaceholder}>Нет</span>}
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

  const editingId = editing && editing !== 'new' ? editing.id : null;

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
            <div
              key={item.id}
              className={`${styles.categoryRow} ${editingId === item.id ? styles.listRowActive : ''}`}
            >
              <div className={styles.itemInfo} onClick={() => setEditing(item)}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemSub}>{item.mask ?? item.localizationPath}</span>
              </div>
              <div className={styles.itemMeta}>
                {item.allowNotifications && <span className={styles.tag}>уведомления</span>}
              </div>
              <div className={styles.itemActions}>
                <EditIconBtn onClick={() => setEditing(item)} />
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
    try { setTariffs(sortTariffsByCost(await tariffApi.getAllForAdmin())); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editingId = editing && editing !== 'new' ? editing.id : null;
  const userTariffs = tariffs.filter(t => !t.forOrganization);
  const organizationTariffs = tariffs.filter(t => t.forOrganization);

  const renderTariffRow = (t: ITariff) => (
    <div
      key={t.id}
      className={`${styles.categoryRow} ${editingId === t.id ? styles.listRowActive : ''}`}
      onClick={() => setEditing(t)}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>{t.name}</span>
        <span className={styles.itemSub}>
          {t.cost === 0 ? 'Бесплатно' : `${t.cost.toLocaleString('ru-RU')} ₽`}
          {' · '}
          {formatPeriod(t)}
        </span>
      </div>
      <div className={styles.itemActions}>
        <EditIconBtn onClick={e => { e.stopPropagation(); setEditing(t); }} />
        <DeleteIconBtn
          title="Удалить тариф"
          onClick={async e => {
            e.stopPropagation();
            if (!confirm(`Удалить тариф «${t.name}»? Это также удалит его валидатор.`)) return;
            try {
              if (t.validatorId) await tariffValidatorApi.delete(t.validatorId);
              await tariffApi.delete(t.id);
              if (editing !== 'new' && (editing as ITariff)?.id === t.id) setEditing(null);
              load();
            } catch (e) {
              alert(e instanceof Error ? e.message : 'Ошибка удаления');
            }
          }}
        />
      </div>
    </div>
  );

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
              <p>Нет тарифов. Создайте первый.</p>
            </div>
          )}
          {tariffs.length > 0 && (
            <>
              <div className={styles.itemGroup}>
                <div className={styles.groupTitle}>Для пользователей</div>
                {userTariffs.length === 0 ? (
                  <div className={styles.groupEmpty}>Нет тарифов</div>
                ) : (
                  userTariffs.map(renderTariffRow)
                )}
              </div>
              <div className={styles.itemGroup}>
                <div className={styles.groupTitle}>Для организаций</div>
                {organizationTariffs.length === 0 ? (
                  <div className={styles.groupEmpty}>Нет тарифов</div>
                ) : (
                  organizationTariffs.map(renderTariffRow)
                )}
              </div>
            </>
          )}
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
                const validatorId = await tariffValidatorApi.create(validatorData);
                await tariffApi.create({ ...tariffData, validatorId });
              } else {
                if (editing.validatorId) {
                  await tariffValidatorApi.update({ ...validatorData, id: editing.validatorId });
                }
                await tariffApi.update({
                  id:              editing.id,
                  name:            tariffData.name,
                  cost:            tariffData.cost,
                  periodDays:      tariffData.periodDays,
                  forOrganization: tariffData.forOrganization,
                  validatorId:     editing.validatorId,
                });
              }
              setEditing(null);
              load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
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
  const [days,  setDays]  = useState(String(tariff?.periodDays ?? tariff?.period?.days ?? 30));
  const [forOrganization, setForOrganization] = useState(!!tariff?.forOrganization);

  const [validatorStr, setValidatorStr] = useState(EMPTY_VALIDATOR_STR);
  const [loadingV,  setLoadingV]  = useState(!!tariff?.validatorId);

  // Сбрасываем и перезагружаем при смене тарифа
  useEffect(() => {
    setName(tariff?.name ?? '');
    setCost(String(tariff?.cost ?? 0));
    setDays(String(tariff?.periodDays ?? tariff?.period?.days ?? 30));
    setForOrganization(!!tariff?.forOrganization);
    setValidatorStr(EMPTY_VALIDATOR_STR);
    setErr(null);

    if (!tariff?.validatorId) { setLoadingV(false); return; }
    setLoadingV(true);
    tariffValidatorApi.getByTariff(tariff.id).then(v => {
      if (v) {
        setValidatorStr({
          costLimit:           v.costLimit    != null ? String(v.costLimit)    : '',
          personsLimit:        v.personsLimit != null ? String(v.personsLimit) : '',
          ageLimit:            v.ageLimit != null ? String(v.ageLimit) : '',
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
    if (
      validatorStr.ageLimit !== ''
      && !EVENT_AGE_LIMIT_OPTIONS.includes(parseInt(validatorStr.ageLimit, 10) as EventAgeLimit)
    ) {
      setErr('Выберите допустимое возрастное ограничение или оставьте пустым');
      return;
    }
    setSaving(true); setErr(null);
    const validator: ITariffValidator = {
      costLimit:              validatorStr.costLimit           !== '' ? parseFloat(validatorStr.costLimit)           : null as any,
      personsLimit:           validatorStr.personsLimit        !== '' ? parseInt(validatorStr.personsLimit)          : null as any,
      ageLimit:               validatorStr.ageLimit !== '' ? parseInt(validatorStr.ageLimit, 10) : null,
      maxEventsCount:         validatorStr.maxEventsCount      !== '' ? parseInt(validatorStr.maxEventsCount)        : null,
      createDateMaxPeriod:    validatorStr.createDateMaxPeriod !== '' ? parseInt(validatorStr.createDateMaxPeriod)   : null,
      allowPrivate:           validatorStr.allowPrivate,
      allowGenderSegregation: validatorStr.allowGenderSegregation,
      allowMultidaysEvent:    validatorStr.allowMultidaysEvent,
    };
    try {
      await onSave(validator, {
        name,
        cost: parseFloat(cost) || 0,
        periodDays: parseInt(days) || 30,
        forOrganization,
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
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={forOrganization}
          onChange={e => setForOrganization(e.target.checked)}
        />
        Для организаций
      </label>

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
          <label className={styles.label}>Возрастной рейтинг событий (пусто = без ограничения)</label>
          <Select
            value={validatorStr.ageLimit}
            onChange={v => setValidatorStr(s => ({ ...s, ageLimit: v }))}
            placeholder="без ограничения"
            options={EVENT_AGE_LIMIT_OPTIONS.map(age => ({
              value: String(age),
              label: formatTariffAgeLimitLabel(age),
            }))}
          />
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
  const days = t.periodDays ?? t.period?.days;
  return days ? `${days} дн.` : '—';
}

// =============================================================================
// ВКЛАДКА: Документы соглашений
// =============================================================================

function AgreementsTab() {
  const [docs, setDocs] = useState<IAgreementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocumentTypeValue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await fetchLastDocuments());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const docByType = (type: DocumentTypeValue) =>
    docs.find(d => Number(d.type) === type) ?? null;

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (error) return <div className={styles.errorMsg}>{error}</div>;

  return (
    <div className={styles.splitPane}>
      <div className={`${styles.listPane} ${selectedType !== null ? styles.mobileHidden : ''}`}>
        <div className={styles.paneHeader}>
          <h2 className={styles.paneTitle}>Документы</h2>
        </div>
        <div className={styles.itemList}>
          {DOCUMENT_TYPE_OPTIONS.map(opt => {
            const current = docByType(opt.value);
            return (
              <div
                key={opt.value}
                className={`${styles.categoryRow} ${selectedType === opt.value ? styles.listRowActive : ''}`}
                onClick={() => setSelectedType(opt.value)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{opt.label}</span>
                  <span className={styles.itemSub}>
                    {current
                      ? `v${current.version}${current.header ? ` · ${current.header}` : ''}`
                      : 'Документ ещё не загружен'}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <EditIconBtn onClick={e => { e.stopPropagation(); setSelectedType(opt.value); }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${styles.formPane} ${selectedType === null ? styles.mobileHidden : ''}`}>
        <button className={styles.mobileBackBtn} onClick={() => setSelectedType(null)}>
          ← Назад к списку
        </button>
        {selectedType !== null ? (
          <AgreementDocumentForm
            key={selectedType}
            type={selectedType}
            onSave={async (payload) => {
              await addAgreementDocument(payload);
              setSelectedType(null);
              await load();
            }}
            onCancel={() => setSelectedType(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите тип документа для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgreementDocumentForm({
  type,
  onSave,
  onCancel,
}: {
  type: DocumentTypeValue;
  onSave: (data: IDocumentRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const typeLabel = DOCUMENT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? 'Документ';
  const [current, setCurrent] = useState<IAgreementDocument | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [header, setHeader] = useState('');
  const [text, setText] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingDoc(true);
    setLoadErr(null);
    setErr(null);
    fetchLastDocument(type)
      .then(doc => {
        if (cancelled) return;
        setCurrent(doc);
        setHeader(doc?.header ?? '');
        setText(doc?.text ?? '');
        setVersion(suggestNextVersion(doc?.version));
      })
      .catch(e => {
        if (cancelled) return;
        setCurrent(null);
        setHeader('');
        setText('');
        setVersion('1.0.0');
        setLoadErr(e instanceof Error ? e.message : 'Не удалось загрузить документ');
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false);
      });
    return () => { cancelled = true; };
  }, [type]);

  const handleSave = async () => {
    if (!header.trim()) { setErr('Укажите заголовок'); return; }
    if (!text.trim()) { setErr('Укажите текст документа'); return; }
    const versionValue = version.trim();
    if (!VERSION_RE.test(versionValue)) {
      setErr('Версия должна быть в формате x.x.x (например, 1.0.0)');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        header: header.trim(),
        text: text.trim(),
        type,
        version: versionValue,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loadingDoc) {
    return <div className={styles.loader}>Загрузка документа...</div>;
  }

  return (
    <div className={`${styles.form} ${styles.agreementForm}`}>
      <h3 className={styles.formTitle}>{typeLabel}</h3>
      {current && (
        <p className={styles.agreementMeta}>
          Текущая версия: <strong>v{current.version}</strong>
          {current.creationDate && (
            <> · {new Date(current.creationDate).toLocaleString('ru-RU')}</>
          )}
        </p>
      )}
      {!current && !loadErr && (
        <p className={styles.agreementMeta}>Документа ещё нет — будет создана первая версия</p>
      )}
      {loadErr && <div className={styles.formError}>{loadErr}</div>}
      {err && <div className={styles.formError}>{err}</div>}

      <FormField label="Заголовок *">
        <input
          className={styles.input}
          value={header}
          onChange={e => setHeader(e.target.value)}
          placeholder="Заголовок документа"
        />
      </FormField>

      <FormField label="Текст документа *">
        <textarea
          className={`${styles.textarea} ${styles.agreementTextarea}`}
          rows={14}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Полный текст соглашения..."
        />
      </FormField>

      <FormField label="Версия *">
        <input
          className={styles.input}
          value={version}
          onChange={e => setVersion(e.target.value)}
          placeholder="1.0.0"
          inputMode="decimal"
          autoComplete="off"
        />
        <span className={styles.fieldHint}>Формат x.x.x, например 1.0.0</span>
      </FormField>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="button" className={styles.saveBtn} onClick={() => { void handleSave(); }} disabled={saving}>
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

function EditIconBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
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
  title = 'Удалить',
}: {
  onClick: (e: React.MouseEvent) => void | Promise<void>;
  title?: string;
}) {
  return (
    <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} onClick={onClick} title={title}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
