// features/subscriptions/SubscribeModal.tsx

import { useState } from 'react';
import type { INotifySettings } from '@/entities/user/subscriptionApi';
import styles from './SubscribeModal.module.css';

interface Props {
  targetLogin: string;
  onConfirm: (settings: INotifySettings) => Promise<void>;
  onCancel: () => void;
}

export function SubscribeModal({ targetLogin, onConfirm, onCancel }: Props) {
  const [settings, setSettings] = useState<INotifySettings>({
    notifyParticipated: true,
    notifyEventCreated: true,
    notifySubscribed:   false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = (key: keyof INotifySettings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подписки');
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Подписаться">
        <h3 className={styles.title}>Подписаться на @{targetLogin}</h3>
        <p className={styles.subtitle}>Выберите уведомления которые хотите получать:</p>

        <div className={styles.options}>
          <label className={styles.option}>
            <input type="checkbox" checked={settings.notifyEventCreated}
              onChange={() => toggle('notifyEventCreated')} />
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Новые события</span>
              <span className={styles.optionDesc}>Пользователь создал новое мероприятие</span>
            </div>
          </label>
          <label className={styles.option}>
            <input type="checkbox" checked={settings.notifyParticipated}
              onChange={() => toggle('notifyParticipated')} />
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Участие в событиях</span>
              <span className={styles.optionDesc}>Пользователь принял участие в мероприятии</span>
            </div>
          </label>
          <label className={styles.option}>
            <input type="checkbox" checked={settings.notifySubscribed}
              onChange={() => toggle('notifySubscribed')} />
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Подписки</span>
              <span className={styles.optionDesc}>Пользователь на кого-то подписался</span>
            </div>
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Отмена
          </button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={loading}>
            {loading ? '...' : 'Подписаться'}
          </button>
        </div>
      </div>
    </>
  );
}
