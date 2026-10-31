// features/subscriptions/SubscribeModal.tsx

import { useState } from 'react';
import type { INotifySettings } from '@/entities/user/subscriptionApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './SubscribeModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface Props {
  targetLogin: string;
  targetAccountId?: string;
  targetAvatarId?: string | null;
  /** organization — только «Новые события»; user — полный набор */
  variant?: 'user' | 'organization';
  /** Логотип организации (fileId) для variant=organization */
  organizationLogoId?: string | null;
  onConfirm: (settings: INotifySettings) => Promise<void>;
  onCancel: () => void;
  initialSettings?: Partial<INotifySettings>;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  /** Вложенный поверх другого модального окна — выше z-index, без второго pushState */
  stacked?: boolean;
}

export function SubscribeModal({
  targetLogin,
  targetAccountId,
  targetAvatarId,
  variant = 'user',
  organizationLogoId = null,
  onConfirm,
  onCancel,
  initialSettings,
  title,
  subtitle,
  confirmLabel,
  stacked = false,
}: Props) {
  useModalBackButton(onCancel, !stacked);
  const isOrg = variant === 'organization';
  const [settings, setSettings] = useState<INotifySettings>({
    notifyParticipated: initialSettings?.notifyParticipated ?? true,
    notifyEventCreated: initialSettings?.notifyEventCreated ?? true,
    notifySubscribed:   initialSettings?.notifySubscribed ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = (key: keyof INotifySettings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(isOrg
        ? {
            notifyEventCreated: settings.notifyEventCreated,
            notifyParticipated: false,
            notifySubscribed: false,
          }
        : settings);
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подписки');
      setLoading(false);
    }
  };

  const displayTitle = title ?? (isOrg
    ? `Подписаться на ${targetLogin}`
    : `Подписаться на @${targetLogin}`);
  const displaySubtitle = subtitle ?? 'Выберите уведомления которые хотите получать:';
  const initials = targetLogin.slice(0, 2).toUpperCase() || '?';
  const showAvatarRow = Boolean(targetAccountId) || isOrg;

  return (
    <>
      <div
        className={stacked ? styles.backdropStacked : styles.backdrop}
        onClick={onCancel}
      />
      <div
        className={stacked ? styles.modalStacked : styles.modal}
        role="dialog"
        aria-modal
        aria-label="Подписаться"
      >
        {showAvatarRow ? (
          <div className={styles.userRow}>
            {isOrg ? (
              <div className={styles.orgAvatar} aria-hidden>
                {organizationLogoId ? (
                  <AuthImage
                    fileId={organizationLogoId}
                    alt=""
                    className={styles.orgAvatarImg}
                    fallback={<span>{initials}</span>}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            ) : (
              <UserAvatar
                accountId={targetAccountId!}
                avatarId={targetAvatarId}
                initials={initials}
                size={40}
              />
            )}
            <div className={styles.userRowText}>
              <h3 className={styles.title}>{displayTitle}</h3>
              <p className={styles.subtitle}>{displaySubtitle}</p>
            </div>
          </div>
        ) : (
          <>
            <h3 className={styles.title}>{displayTitle}</h3>
            <p className={styles.subtitle}>{displaySubtitle}</p>
          </>
        )}

        <div className={styles.options}>
          <label className={styles.option}>
            <input type="checkbox" checked={settings.notifyEventCreated}
              onChange={() => toggle('notifyEventCreated')} />
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Новые события</span>
              <span className={styles.optionDesc}>
                {isOrg
                  ? 'Организация создала новое мероприятие'
                  : 'Пользователь создал новое мероприятие'}
              </span>
            </div>
          </label>
          {!isOrg && (
            <>
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
            </>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            Отмена
          </button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={loading}>
            {loading ? '...' : (confirmLabel ?? 'Подписаться')}
          </button>
        </div>
      </div>
    </>
  );
}
