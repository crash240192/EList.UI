import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, Ref, RefObject } from 'react';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { MessageComposer } from './MessageComposer';
import type { DiscussionSlotRect } from './useDiscussionSlotRect';
import styles from './DiscussionComposerSheet.module.css';

interface DiscussionComposerSheetProps {
  open: boolean;
  onClose: () => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  onSubmit: (text: string) => Promise<void>;
  sheetRef?: RefObject<HTMLDivElement | null>;
  /** Колонка обсуждения в viewport — форма fixed внизу экрана с этой шириной */
  slot: DiscussionSlotRect;
}

/** Fixed внизу viewport, ширина как у блока обсуждения (не конец длинного списка) */
export function DiscussionComposerSheet({
  open,
  onClose,
  replyingTo,
  onCancelReply,
  onSubmit,
  sheetRef,
  slot,
}: DiscussionComposerSheetProps) {
  const dimRef = useRef<HTMLDivElement>(null);
  const localSheetRef = useRef<HTMLDivElement>(null);
  const resolvedSheetRef = sheetRef ?? localSheetRef;

  useModalBackButton(onClose, open);

  useEffect(() => {
    if (!open) return;

    const onDocumentPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (resolvedSheetRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  }, [open, onClose, resolvedSheetRef]);

  if (!open) return null;

  const sheetStyle: CSSProperties = {
    left: slot.width > 0 ? Math.max(8, slot.left) : 8,
    width: slot.width > 0 ? Math.max(200, Math.min(slot.width, window.innerWidth - 16)) : Math.min(560, window.innerWidth - 16),
    bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
  };

  return createPortal(
    <>
      <div ref={dimRef} className={styles.dim} onClick={onClose} role="presentation" aria-hidden />
      <div
        ref={resolvedSheetRef as Ref<HTMLDivElement>}
        className={styles.sheet}
        style={sheetStyle}
        role="dialog"
        aria-modal
        aria-label="Написать комментарий"
      >
        <MessageComposer
          autoFocus
          replyingTo={replyingTo}
          onCancelReply={onCancelReply}
          onSubmit={onSubmit}
        />
      </div>
    </>,
    document.body,
  );
}
