import { useEffect, useRef, useState } from 'react';
import { clampText, textLengthError } from '@/shared/lib/clampText';
import { TextLengthHint } from '@/shared/ui/TextLengthHint/TextLengthHint';
import { DISCUSSION_MESSAGE_MAX_LENGTH } from './discussionUiConstants';
import styles from './MessageComposer.module.css';

interface MessageComposerProps {
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  embedded?: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
  onSubmit: (text: string) => Promise<void>;
}

export function MessageComposer({
  placeholder = 'Написать комментарий…',
  submitLabel = 'Отправить',
  disabled = false,
  autoFocus = false,
  embedded = false,
  replyingTo,
  onCancelReply,
  onSubmit,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (raw: string) => {
    setText(clampText(raw, DISCUSSION_MESSAGE_MAX_LENGTH));
  };

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 180);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus, replyingTo]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    const error = textLengthError(trimmed.length, DISCUSSION_MESSAGE_MAX_LENGTH);
    if (!trimmed || sending || disabled || error) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${styles.wrap} ${embedded ? styles.wrapEmbedded : ''}`}>
      {replyingTo && (
        <div className={styles.replyBanner}>
          <span>Ответ на: {replyingTo}</span>
          {onCancelReply && (
            <button type="button" className={styles.cancelReply} onClick={onCancelReply}>
              Отмена
            </button>
          )}
        </div>
      )}
      <textarea
        ref={inputRef}
        className={styles.input}
        rows={3}
        value={text}
        disabled={disabled || sending}
        placeholder={placeholder}
        maxLength={DISCUSSION_MESSAGE_MAX_LENGTH}
        onChange={(e) => handleTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>Ctrl+Enter — отправить</span>
        <div className={styles.submitRow}>
          <TextLengthHint length={text.length} maxLength={DISCUSSION_MESSAGE_MAX_LENGTH} />
          <button
            type="button"
            className={styles.submit}
            disabled={disabled || sending || !text.trim() || text.trim().length > DISCUSSION_MESSAGE_MAX_LENGTH}
            onClick={() => void handleSubmit()}
          >
            {sending ? 'Отправка…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
