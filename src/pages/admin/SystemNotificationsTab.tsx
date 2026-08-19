// pages/admin/SystemNotificationsTab.tsx

import { useCallback, useEffect, useState } from 'react';
import {
  SystemNotificationType,
  SYSTEM_NOTIFICATION_TYPE_LABELS,
  fetchAllSystemNotifications,
  createSystemNotification,
  updateSystemNotification,
  deleteSystemNotification,
  type ISystemNotification,
  type ISystemNotificationRequest,
  type SystemNotificationTypeValue,
} from '@/entities/admin/systemNotificationsApi';
import { Select } from '@/shared/ui/Select/Select';
import styles from './AdminPage.module.css';

const TYPE_OPTIONS = Object.values(SystemNotificationType).map(value => ({
  value,
  label: SYSTEM_NOTIFICATION_TYPE_LABELS[value],
}));

export function SystemNotificationsTab() {
  const [items, setItems] = useState<ISystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ISystemNotification | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchAllSystemNotifications());
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
          <h2 className={styles.paneTitle}>Системные уведомления</h2>
          <button type="button" className={styles.addBtn} onClick={() => setEditing('new')}>
            + Добавить
          </button>
        </div>
        <div className={styles.itemList}>
          {items.length === 0 && (
            <div className={styles.groupEmpty}>Уведомлений пока нет</div>
          )}
          {items.map(item => (
            <div
              key={item.id}
              className={`${styles.typeRow} ${editingId === item.id ? styles.listRowActive : ''}`}
            >
              <div className={styles.itemInfo} onClick={() => setEditing(item)}>
                <span className={styles.itemName}>{item.header || '(без заголовка)'}</span>
                <span className={styles.itemSub}>
                  {SYSTEM_NOTIFICATION_TYPE_LABELS[item.type] || item.type}
                </span>
                <span className={styles.itemSub}>
                  {item.shortMessage || item.message?.slice(0, 60)}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setEditing(item)}
                  aria-label="Редактировать"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.dangerBtn}`}
                  aria-label="Удалить"
                  onClick={async e => {
                    e.stopPropagation();
                    if (!window.confirm(`Удалить уведомление «${item.header}»?`)) return;
                    try {
                      await deleteSystemNotification(item.id);
                      if (editingId === item.id) setEditing(null);
                      await load();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : 'Не удалось удалить');
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
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
          <NotificationForm
            key={editing === 'new' ? 'new-sysnotif' : (editing as ISystemNotification).id}
            item={editing === 'new' ? null : editing}
            onSave={async data => {
              if (editing === 'new') {
                await createSystemNotification(data);
              } else {
                await updateSystemNotification(editing.id, data);
              }
              setEditing(null);
              await load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className={styles.emptyForm}>
            <p>Выберите уведомление для редактирования</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationForm({
  item,
  onSave,
  onCancel,
}: {
  item: ISystemNotification | null;
  onSave: (data: ISystemNotificationRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ISystemNotificationRequest>({
    type: item?.type ?? SystemNotificationType.AccountCreated,
    header: item?.header ?? '',
    message: item?.message ?? '',
    shortMessage: item?.shortMessage ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof ISystemNotificationRequest>(key: K, value: ISystemNotificationRequest[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.header.trim()) { setErr('Заголовок обязателен'); return; }
    if (!form.message.trim()) { setErr('Текст обязателен'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.form}>
      <h3 className={styles.formTitle}>
        {item ? 'Редактирование' : 'Новое уведомление'}
      </h3>

      <div className={styles.field}>
        <label className={styles.label}>Тип</label>
        <Select
          value={form.type}
          onChange={v => set('type', v as SystemNotificationTypeValue)}
          options={TYPE_OPTIONS}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Заголовок</label>
        <input
          className={styles.input}
          value={form.header}
          onChange={e => set('header', e.target.value)}
          placeholder="Заголовок уведомления"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Текст (message)</label>
        <textarea
          className={styles.textarea}
          value={form.message}
          onChange={e => set('message', e.target.value)}
          rows={5}
          placeholder="Полный текст уведомления"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Короткий текст (shortMessage)</label>
        <textarea
          className={styles.textarea}
          value={form.shortMessage}
          onChange={e => set('shortMessage', e.target.value)}
          rows={2}
          placeholder="Краткое описание для превью"
        />
      </div>

      {err && <div className={styles.formError}>{err}</div>}

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Отмена
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
