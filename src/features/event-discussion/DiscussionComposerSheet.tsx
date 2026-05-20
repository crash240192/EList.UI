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

/** Оверлей внутри блока обсуждения — та же форма, что и внизу ленты */
export function DiscussionComposerSheet({
  open,
  onClose,
  replyingTo,
  onCancelReply,
  onSubmit,
}: DiscussionComposerSheetProps) {
  useModalBackButton(onClose, open);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <button type="button" className={styles.backdrop} onClick={onClose} aria-label="Закрыть форму" />
      <div className={styles.sheet} role="dialog" aria-modal aria-label="Написать комментарий">
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
