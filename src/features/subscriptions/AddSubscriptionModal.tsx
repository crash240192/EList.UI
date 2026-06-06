// features/subscriptions/AddSubscriptionModal.tsx

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canUseQrScanner, isUserId, parseUserIdFromText } from '@/shared/lib/userId';
import { QrScanner } from '@/shared/ui/QrScanner/QrScanner';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './AddSubscriptionModal.module.css';

interface Props {
  onClose: () => void;
  onBeforeNavigate?: () => void | Promise<void>;
}

export function AddSubscriptionModal({ onClose, onBeforeNavigate }: Props) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const showScanner = canUseQrScanner();

  const handleBack = useCallback(() => {
    if (scanning) setScanning(false);
    else onClose();
  }, [scanning, onClose]);

  useModalBackButton(handleBack, false);

  const normalizedId = parseUserIdFromText(value) ?? (isUserId(value) ? value.trim() : null);

  const goToProfile = async () => {
    const userId = normalizedId;
    if (!userId) {
      setError('Введите корректный идентификатор пользователя');
      return;
    }

    setError(null);
    try {
      await onBeforeNavigate?.();
    } catch {
      return;
    }
    onClose();
    navigate(`/user/${userId}`);
  };

  const handleDetected = (userId: string) => {
    setValue(userId);
    setScanning(false);
    setError(null);
  };

  return (
    <>
      <div className={styles.backdropStacked} onClick={handleBack} />
      <div className={styles.modalStacked} role="dialog" aria-modal aria-label="Добавить подписку">
        <h3 className={styles.title}>Добавить подписку</h3>
        <p className={styles.subtitle}>
          Вставьте идентификатор пользователя или отсканируйте QR-код
        </p>

        {scanning ? (
          <QrScanner onDetected={handleDetected} onClose={() => setScanning(false)} />
        ) : (
          <>
            <input
              className={styles.input}
              placeholder="Идентификатор пользователя"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {error && <p className={styles.error}>{error}</p>}
            {showScanner && (
              <button type="button" className={styles.scanBtn} onClick={() => setScanning(true)}>
                <QrIcon />
                Сканировать QR-код
              </button>
            )}
          </>
        )}

        {!scanning && (
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={handleBack}>Отмена</button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() => { void goToProfile(); }}
              disabled={!normalizedId}
            >
              Перейти
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function QrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><path d="M14 14h2v2h-2zM18 14h3v3h-3z" />
    </svg>
  );
}
