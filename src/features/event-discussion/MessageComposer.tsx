import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus, replyingTo]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
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
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>Ctrl+Enter — отправить</span>
        <button
          type="button"
          className={styles.submit}
          disabled={disabled || sending || !text.trim()}
          onClick={() => void handleSubmit()}
        >
          {sending ? 'Отправка…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
