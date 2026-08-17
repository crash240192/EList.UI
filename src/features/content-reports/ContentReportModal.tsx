// features/content-reports/ContentReportModal.tsx

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createContentReport,
  fetchReportReasons,
  REPORT_CREATE_TITLES,
  ReportSeverity,
  type IReportReason,
  type ReportTargetTypeValue,
} from '@/entities/contentReport';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { useToastStore } from '@/app/store';
import { contentReportSubmitMessage, isAlreadyReportedError } from './reportSubmitError';
import styles from './ContentReportModal.module.css';

const COMMENT_MAX = 2000;

interface ContentReportModalProps {
  targetType: ReportTargetTypeValue;
  targetId: string;
  albumId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ContentReportModal({
  targetType,
  targetId,
  albumId,
  onClose,
  onSubmitted,
}: ContentReportModalProps) {
  const toast = useToastStore(s => s.add);
  const [reasons, setReasons] = useState<IReportReason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalBackButton(onClose);

  const title = REPORT_CREATE_TITLES[targetType] || 'Пожаловаться';

  const loadReasons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchReportReasons({
        onlyActive: true,
        forTargetType: targetType,
      });
      setReasons(list);
      if (list.length > 0) setReasonId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить причины');
    } finally {
      setLoading(false);
    }
  }, [targetType]);

  useEffect(() => {
    void loadReasons();
  }, [loadReasons]);

  const handleSubmit = async () => {
    if (!reasonId) {
      setError('Выберите причину');
      return;
    }
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      await createContentReport({
        targetType,
        targetId,
        albumId: albumId || undefined,
        reasonId,
        comment: comment.trim() || null,
      });
      toast('Жалоба отправлена', 'success');
      onSubmitted?.();
      onClose();
    } catch (e) {
      const msg = contentReportSubmitMessage(e);
      setError(msg);
      toast(msg, isAlreadyReportedError(e) ? 'info' : 'error');
      if (isAlreadyReportedError(e)) onSubmitted?.();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="content-report-title">
        <div className={styles.modalHeader}>
          <span id="content-report-title" className={styles.modalTitle}>
            {title}
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.hint}>
            Выберите причину. Серьёзные нарушения безопасности проверяет площадка.
          </p>

          <div className={styles.field}>
            <span className={styles.label}>Причина *</span>
            {loading ? (
              <div className={styles.empty}>Загрузка…</div>
            ) : reasons.length === 0 ? (
              <div className={styles.empty}>Нет доступных причин</div>
            ) : (
              <div className={styles.reasonList} role="radiogroup" aria-label="Причина жалобы">
                {reasons.map(reason => {
                  const selected = reason.id === reasonId;
                  const safety = reason.severity === ReportSeverity.Safety;
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={[
                        styles.reasonItem,
                        selected ? styles.reasonItemSelected : '',
                        safety ? styles.reasonItemSafety : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setReasonId(reason.id)}
                      disabled={saving}
                    >
                      <span className={styles.reasonNameRow}>
                        <span className={styles.reasonName}>{reason.name}</span>
                        {safety && <span className={styles.safetyBadge}>серьёзное</span>}
                      </span>
                      {reason.description ? (
                        <p className={styles.reasonDesc}>{reason.description}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="content-report-comment">
              Комментарий
            </label>
            <textarea
              id="content-report-comment"
              className={styles.textarea}
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Дополнительно (необязательно)"
              rows={4}
              disabled={saving}
              maxLength={COMMENT_MAX}
            />
            <span className={styles.charCount}>{comment.length} / {COMMENT_MAX}</span>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => void handleSubmit()}
            disabled={saving || loading || !reasons.length || !reasonId}
          >
            {saving ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
