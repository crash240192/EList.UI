import { useCallback, useEffect, useRef, useState } from 'react';
import { clampText, textLengthError } from '@/shared/lib/clampText';
import { TextLengthHint } from '@/shared/ui/TextLengthHint/TextLengthHint';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { filterImageFiles } from '@/shared/lib/imageFile';
import {
  DISCUSSION_MESSAGE_MAX_FILES,
  DISCUSSION_MESSAGE_MAX_LENGTH,
} from './discussionUiConstants';
import styles from './MessageComposer.module.css';

interface ShotItem {
  localId: string;
  previewUrl: string;
  fileId?: string;
  uploading?: boolean;
  error?: string;
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
  const [shots, setShots] = useState<ShotItem[]>([]);
  const [sending, setSending] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const readyShots = shots.filter(s => s.fileId && !s.error && !s.uploading);
  const uploadingCount = shots.filter(s => s.uploading).length;
  const uploading = uploadingCount > 0;

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

  const revokeShots = useCallback((items: ShotItem[]) => {
    items.forEach(s => URL.revokeObjectURL(s.previewUrl));
  }, []);

  useEffect(() => () => {
    revokeShots(shotsRef.current);
  }, [revokeShots]);

  const clearShots = () => {
    setShots(prev => {
      revokeShots(prev);
      return [];
    });
  };

  const removeShot = (localId: string) => {
    setShots(prev => {
      const target = prev.find(s => s.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(s => s.localId !== localId);
    });
  };

  const handleFiles = (list: FileList | null) => {
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

    setAttachError(null);
    const placeholders: Array<ShotItem & { file: File }> = images.map(file => ({
      localId: nextLocalId(),
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      file,
    }));

    setShots(prev => [
      ...prev,
      ...placeholders.map(({ localId, previewUrl, uploading }) => ({ localId, previewUrl, uploading })),
    ].slice(0, DISCUSSION_MESSAGE_MAX_FILES));

    for (const placeholder of placeholders) {
      void uploadFile(placeholder.file)
        .then(result => {
          setShots(prev => prev.map(item => (
            item.localId === placeholder.localId
              ? { ...item, fileId: result.id, uploading: false }
              : item
          )));
        })
        .catch(e => {
          const message = e instanceof Error ? e.message : 'Не удалось загрузить фото';
          setAttachError(message);
          setShots(prev => prev.map(item => (
            item.localId === placeholder.localId && !item.error
              ? { ...item, uploading: false, error: message }
              : item
          )));
        });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    const fileIds = readyShots.map(s => s.fileId!);
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
    && (text.trim().length > 0 || readyShots.length > 0)
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
            <div
              key={shot.localId}
              className={`${styles.shot} ${shot.uploading ? styles.shotUploading : ''}`}
              aria-busy={shot.uploading}
              aria-label={shot.error ? 'Ошибка загрузки' : shot.uploading ? 'Загрузка фото' : 'Фото'}
            >
              <img
                src={shot.previewUrl}
                alt=""
                className={`${styles.shotImg} ${shot.uploading || shot.error ? styles.shotImgDim : ''}`}
              />
              {shot.error ? (
                <div className={styles.shotError} title={shot.error}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              ) : shot.uploading ? (
                <div className={styles.shotOverlay}>
                  <div className={styles.shotSpinner} aria-hidden />
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.shotRemove}
                  aria-label="Убрать фото"
                  disabled={sending}
                  onClick={() => removeShot(shot.localId)}
                >
                  ×
                </button>
              )}
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
            disabled={disabled || sending || shots.length >= DISCUSSION_MESSAGE_MAX_FILES}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            className={styles.attachBtn}
            disabled={disabled || sending || shots.length >= DISCUSSION_MESSAGE_MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Прикрепить фото"
          >
            {uploading ? `Загрузка… (${uploadingCount})` : 'Фото'}
          </button>
          {shots.length > 0 && (
            <span className={styles.attachCount}>
              {readyShots.length}/{DISCUSSION_MESSAGE_MAX_FILES}
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
