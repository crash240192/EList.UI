// features/user/UserShareMenu.tsx

import { useCallback, useState } from 'react';
import { useToastStore } from '@/app/store';
import {
  buildUserProfileUrl,
  canUseNativeShare,
  copyText,
  shareLink,
} from '@/shared/lib/shareLink';
import { QrCodeImage } from '@/shared/ui/QrCode/QrCodeImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './UserShareMenu.module.css';

interface Props {
  accountId: string;
  login: string;
  onClose: () => void;
}

type View = 'menu' | 'qr';

export function UserShareMenu({ accountId, login, onClose }: Props) {
  const [view, setView] = useState<View>('menu');
  const handleBack = useCallback(() => {
    if (view === 'qr') setView('menu');
    else onClose();
  }, [view, onClose]);

  useModalBackButton(handleBack);

  const handleCopyId = () => {
    void copyText(accountId)
      .then(() => {
        useToastStore.getState().add('Идентификатор скопирован', 'success');
        onClose();
      })
      .catch(() => useToastStore.getState().add('Не удалось скопировать', 'error'));
  };

  const handleNativeShare = () => {
    const url = buildUserProfileUrl(accountId);
    void shareLink({
      title: `Профиль @${login}`,
      text: accountId,
      url,
    })
      .then((result) => {
        useToastStore.getState().add(
          result === 'shared' ? 'Идентификатор отправлен' : 'Идентификатор скопирован',
          'success',
        );
        onClose();
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        useToastStore.getState().add('Не удалось поделиться', 'error');
      });
  };

  if (view === 'qr') {
    return (
      <>
        <div className={styles.backdrop} onClick={handleBack} />
        <div className={styles.modal} role="dialog" aria-modal aria-label="QR-код профиля">
          <div className={styles.header}>
            <h3 className={styles.title}>QR-код профиля</h3>
            <button type="button" className={styles.closeBtn} onClick={handleBack} aria-label="Назад">✕</button>
          </div>
          <p className={styles.subtitle}>Отсканируйте камерой, чтобы открыть профиль @{login}</p>
          <div className={styles.qrWrap}>
            <QrCodeImage value={accountId} />
          </div>
          <p className={styles.idHint}>{accountId}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Поделиться профилем">
        <div className={styles.header}>
          <h3 className={styles.title}>Поделиться</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <p className={styles.subtitle}>Выберите способ передачи идентификатора @{login}</p>
        <div className={styles.options}>
          <button type="button" className={styles.optionBtn} onClick={handleCopyId}>
            <CopyIcon />
            <span>Скопировать идентификатор</span>
          </button>
          {canUseNativeShare() && (
            <button type="button" className={styles.optionBtn} onClick={handleNativeShare}>
              <ShareIcon />
              <span>Поделиться</span>
            </button>
          )}
          <button type="button" className={styles.optionBtn} onClick={() => setView('qr')}>
            <QrIcon />
            <span>Показать QR-код</span>
          </button>
        </div>
      </div>
    </>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h2v3h-2zM18 18h1v1h-1zM21 18h1v3h-1z" />
    </svg>
  );
}
