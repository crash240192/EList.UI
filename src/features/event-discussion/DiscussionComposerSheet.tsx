import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { MessageComposer } from './MessageComposer';
import styles from './DiscussionComposerSheet.module.css';

interface DiscussionComposerSheetProps {
  open: boolean;
  onClose: () => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  onSubmit: (text: string) => Promise<void>;
}

export function DiscussionComposerSheet({
  open,
  onClose,
  replyingTo,
  onCancelReply,
  onSubmit,
}: DiscussionComposerSheetProps) {
  useModalBackButton(onClose, open);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdrop} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal aria-label="Написать комментарий">
        <div className={styles.handle} />
        <div className={styles.header}>
          <span className={styles.title}>{replyingTo ? 'Ответ на комментарий' : 'Новый комментарий'}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          <MessageComposer
            autoFocus
            embedded
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
