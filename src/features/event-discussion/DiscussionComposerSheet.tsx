import { useEffect, useRef } from 'react';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { MessageComposer } from './MessageComposer';
import styles from './DiscussionComposerSheet.module.css';

interface DiscussionComposerSheetProps {
  open: boolean;
  onClose: () => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  onSubmit: (text: string) => Promise<void>;
  sheetRef?: React.RefObject<HTMLDivElement | null>;
}

/** Оверлей внутри блока обсуждения — та же форма, что и внизу ленты */
export function DiscussionComposerSheet({
  open,
  onClose,
  replyingTo,
  onCancelReply,
  onSubmit,
  sheetRef,
}: DiscussionComposerSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const localSheetRef = useRef<HTMLDivElement>(null);
  const resolvedSheetRef = sheetRef ?? localSheetRef;

  useModalBackButton(onClose, open);

  useEffect(() => {
    if (!open) return;

    const onDocumentPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (resolvedSheetRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) {
        onClose();
        return;
      }
      onClose();
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }, [open, onClose, resolvedSheetRef]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className={styles.overlay} role="presentation">
      <div className={styles.backdrop} aria-hidden />
      <div
        ref={resolvedSheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal
        aria-label="Написать комментарий"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <MessageComposer
          autoFocus
          replyingTo={replyingTo}
          onCancelReply={onCancelReply}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
