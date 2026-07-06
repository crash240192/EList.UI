import { useCallback, useState, type ReactNode } from 'react';
import { useToastStore } from '@/app/store';
import {
  canUseNativeShare,
  copyText,
  shareLink,
} from '@/shared/lib/shareLink';
import { QrCodeImage } from '@/shared/ui/QrCode/QrCodeImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './ShareMenu.module.css';

export interface ShareMenuExtraOption {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface ShareMenuProps {
  subtitle: string;
  url: string;
  shareTitle: string;
  shareText?: string;
  onClose: () => void;
  title?: string;
  qrTitle?: string;
  qrSubtitle?: string;
  prependOptions?: ShareMenuExtraOption[];
}

type View = 'menu' | 'qr';

export function ShareMenu({
  subtitle,
  url,
  shareTitle,
  shareText,
  onClose,
  title = 'Поделиться',
  qrTitle = 'QR-код',
  qrSubtitle,
  prependOptions = [],
}: ShareMenuProps) {
  const [view, setView] = useState<View>('menu');

  const handleBack = useCallback(() => {
    if (view === 'qr') setView('menu');
    else onClose();
  }, [view, onClose]);

  useModalBackButton(handleBack);

  const handleCopyLink = () => {
    void copyText(url)
      .then(() => {
        useToastStore.getState().add('Ссылка скопирована', 'success');
        onClose();
      })
      .catch(() => useToastStore.getState().add('Не удалось скопировать', 'error'));
  };

  const handleShareLink = () => {
    void shareLink({ title: shareTitle, text: shareText, url })
      .then((result) => {
        const copiedMsg = canUseNativeShare()
          ? 'Ссылка скопирована в буфер обмена'
          : 'Ссылка скопирована (нужен HTTPS для системного шаринга)';
        useToastStore.getState().add(
          result === 'shared' ? 'Ссылка отправлена' : copiedMsg,
          'success',
        );
        onClose();
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        useToastStore.getState().add('Не удалось поделиться ссылкой', 'error');
      });
  };

  if (view === 'qr') {
    return (
      <>
        <div className={styles.backdrop} onClick={handleBack} />
        <div className={styles.modal} role="dialog" aria-modal aria-label={qrTitle}>
          <div className={styles.header}>
            <h3 className={styles.title}>{qrTitle}</h3>
            <button type="button" className={styles.closeBtn} onClick={handleBack} aria-label="Назад">✕</button>
          </div>
          {qrSubtitle && <p className={styles.subtitle}>{qrSubtitle}</p>}
          <div className={styles.qrWrap}>
            <QrCodeImage value={url} />
          </div>
          <p className={styles.urlHint}>{url}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label={title}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.options}>
          {prependOptions.map((opt, i) => (
            <button key={i} type="button" className={styles.optionBtn} onClick={opt.onClick}>
              {opt.icon ?? <CopyIcon />}
              <span>{opt.label}</span>
            </button>
          ))}
          <button type="button" className={styles.optionBtn} onClick={handleCopyLink}>
            <CopyIcon />
            <span>Скопировать ссылку</span>
          </button>
          <button type="button" className={styles.optionBtn} onClick={handleShareLink}>
            <ShareIcon />
            <span>Поделиться ссылкой</span>
          </button>
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
