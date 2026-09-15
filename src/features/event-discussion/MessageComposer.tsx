import { useEffect, useRef, useState } from 'react';
import { clampText, textLengthError } from '@/shared/lib/clampText';
import { TextLengthHint } from '@/shared/ui/TextLengthHint/TextLengthHint';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { filterImageFiles } from '@/shared/lib/imageFile';
import {
  DISCUSSION_MESSAGE_MAX_FILES,
  DISCUSSION_MESSAGE_MAX_LENGTH,
} from './discussionUiConstants';
import styles from './MessageComposer.module.css';

interface PendingShot {
  localId: string;
  fileId: string;
  previewUrl: string;
}

export interface MessageComposerSubmitPayload {
  text: string;
  fileIds: string[];
}

interface MessageComposerProps {
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  embedded?: boolean;
  replyingTo?: string | null;
  onCancelReply?: () => void;
  onSubmit: (payload: MessageComposerSubmitPayload) => Promise<void>;
}

function nextLocalId(): string {
  return `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const [shots, setShots] = useState<PendingShot[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

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

  useEffect(() => () => {
    shotsRef.current.forEach(s => URL.revokeObjectURL(s.previewUrl));
  }, []);

  const clearShots = () => {
    setShots(prev => {
      prev.forEach(s => URL.revokeObjectURL(s.previewUrl));
      return [];
    });
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length || disabled || sending) return;
    const remaining = DISCUSSION_MESSAGE_MAX_FILES - shots.length;
    if (remaining <= 0) {
      setAttachError(`Не больше ${DISCUSSION_MESSAGE_MAX_FILES} фото`);
      return;
    }

    const images = filterImageFiles(list).slice(0, remaining);
    if (!images.length) {
      setAttachError('Можно прикладывать только изображения');
      return;
    }

    setUploading(true);
    setAttachError(null);
    try {
      const uploaded: PendingShot[] = [];
      for (const file of images) {
        const previewUrl = URL.createObjectURL(file);
        const result = await uploadFile(file);
        uploaded.push({ localId: nextLocalId(), fileId: result.id, previewUrl });
      }
      if (uploaded.length) {
        setShots(prev => [...prev, ...uploaded].slice(0, DISCUSSION_MESSAGE_MAX_FILES));
      }
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeShot = (localId: string) => {
    setShots(prev => {
      const target = prev.find(s => s.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(s => s.localId !== localId);
    });
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    const fileIds = shots.map(s => s.fileId);
    const error = textLengthError(trimmed.length, DISCUSSION_MESSAGE_MAX_LENGTH);
    if ((!trimmed && fileIds.length === 0) || sending || uploading || disabled || error) return;
    setSending(true);
    try {
      await onSubmit({ text: trimmed, fileIds });
      setText('');
      clearShots();
      setAttachError(null);
    } finally {
      setSending(false);
    }
  };

  const canSubmit =
    !disabled
    && !sending
    && !uploading
    && (text.trim().length > 0 || shots.length > 0)
    && text.trim().length <= DISCUSSION_MESSAGE_MAX_LENGTH;

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
        rows={2}
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
      {shots.length > 0 && (
        <div className={styles.shots}>
          {shots.map(shot => (
            <div key={shot.localId} className={styles.shot}>
              <img src={shot.previewUrl} alt="" className={styles.shotImg} />
              <button
                type="button"
                className={styles.shotRemove}
                aria-label="Убрать фото"
                disabled={sending}
                onClick={() => removeShot(shot.localId)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {attachError && <p className={styles.attachError}>{attachError}</p>}
      <div className={styles.actions}>
        <div className={styles.attachRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className={styles.fileInput}
            disabled={disabled || sending || uploading || shots.length >= DISCUSSION_MESSAGE_MAX_FILES}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            className={styles.attachBtn}
            disabled={disabled || sending || uploading || shots.length >= DISCUSSION_MESSAGE_MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Прикрепить фото"
          >
            {uploading ? 'Загрузка…' : 'Фото'}
          </button>
          {shots.length > 0 && (
            <span className={styles.attachCount}>
              {shots.length}/{DISCUSSION_MESSAGE_MAX_FILES}
            </span>
          )}
          <span className={styles.hint}>Ctrl+Enter — отправить</span>
        </div>
        <div className={styles.submitRow}>
          <TextLengthHint length={text.length} maxLength={DISCUSSION_MESSAGE_MAX_LENGTH} />
          <button
            type="button"
            className={styles.submit}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {sending ? 'Отправка…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
