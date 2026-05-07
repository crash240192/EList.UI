// features/event/RatingWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { fetchEventRating, voteEventRating } from '@/entities/event';
import type { IRatingItem, IRatingPage, RatingType } from '@/entities/event';
import styles from './RatingWidget.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

interface WidgetProps {
  eventId: string;
  eventStartTime: string;
  accountId: string | null;
}

function getRatingType(startTime: string): RatingType {
  return new Date(startTime) <= new Date() ? 'Summary' : 'Expectation';
}

// ── Grade system ─────────────────────────────────────────────────────────────

type Grade = { label: string; color: string; rot: number };

function getGrade(score: number): Grade {
  if (score >= 4.99) return { label: 'A++', color: '#16a34a', rot: -7 };
  if (score >= 4.95) return { label: 'A+',  color: '#22c55e', rot: -5 };
  if (score >= 4.7)  return { label: 'A',   color: '#4ade80', rot: -3 };
  if (score >= 4.0)  return { label: 'B',   color: '#3b82f6', rot:  4 };
  if (score >= 3.0)  return { label: 'C',   color: '#f59e0b', rot: -6 };
  if (score >= 2.0)  return { label: 'D',   color: '#f97316', rot:  3 };
  if (score >= 1.0)  return { label: 'F',   color: '#ef4444', rot: -8 };
  return               { label: 'F−', color: '#dc2626', rot:  5 };
}

function getSimpleGrade(score: number): Grade {
  if (score >= 5)  return { label: 'A', color: '#4ade80', rot: -3 };
  if (score >= 4)  return { label: 'B', color: '#3b82f6', rot:  4 };
  if (score >= 3)  return { label: 'C', color: '#f59e0b', rot: -6 };
  if (score >= 2)  return { label: 'D', color: '#f97316', rot:  3 };
  return                   { label: 'F', color: '#ef4444', rot: -8 };
}

// Слегка неровный круг — имитация нарисованного от руки
const ROUGH_CIRCLE =
  'M24,6 C34,2 41,12 38,22 C36,33 26,38 14,36 C3,34 -1,26 2,17 C5,8 14,4 23,5 C28,5 34,8 31,14';

function GradeBadge({ score, size = 'sm', simple = false }: { score: number; size?: 'xs' | 'sm' | 'lg'; simple?: boolean }) {
  const { label, color, rot } = simple ? getSimpleGrade(score) : getGrade(score);
  const long = label.length > 1;
  return (
    <span
      className={`${styles.gb} ${styles[`gb_${size}`]}`}
      style={{ color, transform: `rotate(${rot}deg)` }}
      aria-label={label}
    >
      <svg viewBox="0 0 40 40" fill="none" className={styles.gbRing} aria-hidden>
        <path d={ROUGH_CIRCLE} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className={`${styles.gbLabel} ${long ? styles.gbLabelLong : ''}`}>{label}</span>
    </span>
  );
}

// ── Grade picker (форма оценки) ───────────────────────────────────────────────

function GradePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.gradePicker}>
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          className={`${styles.gpItem} ${value === v ? styles.gpSelected : ''}`}
          onClick={() => onChange(value === v ? 0 : v)}
          title={getGrade(v).label}
        >
          <GradeBadge score={v} size="sm" simple />
          <span className={styles.gpNum}>{v}</span>
        </button>
      ))}
    </div>
  );
}

// ── Rating item row ───────────────────────────────────────────────────────────

function RatingItemRow({ item }: { item: IRatingItem }) {
  const name = item.personInfo?.firstName
    ? `${item.personInfo.firstName} ${item.personInfo.lastName ?? ''}`.trim()
    : item.account.login;
  return (
    <div className={styles.ratingItem}>
      <div className={styles.ratingItemHeader}>
        <div className={styles.ratingItemAvatar}>{name[0]?.toUpperCase() ?? '?'}</div>
        <div className={styles.ratingItemMeta}>
          <span className={styles.ratingItemName}>{name}</span>
          {item.value > 0 && <GradeBadge score={item.value} size="xs" simple />}
        </div>
      </div>
      {item.comment && <p className={styles.ratingItemComment}>{item.comment}</p>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  eventId: string;
  ratingType: RatingType;
  accountId: string | null;
  initialData: IRatingPage;
  onClose: () => void;
  onDataUpdate: (d: IRatingPage) => void;
}

const PAGE_SIZE = 20;

function RatingModal({ eventId, ratingType, accountId, initialData, onClose, onDataUpdate }: ModalProps) {
  useModalBackButton(onClose);
  const label = ratingType === 'Expectation' ? 'Рейтинг ожидания' : 'Рейтинг';

  const [data,        setData]        = useState<IRatingPage>(initialData);
  const [pageIndex,   setPageIndex]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [voteValue,   setVoteValue]   = useState(0);
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const myItem = accountId ? data.items.find(i => i.accountId === accountId) ?? null : null;
  const voted = !!myItem;
  const score = data.resultRating;
  const hasMore = data.items.length < data.total;

  // Загружаем первую страницу при открытии
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEventRating(eventId, ratingType, 0, PAGE_SIZE)
      .then(page => {
        if (cancelled) return;
        setData(page);
        setPageIndex(0);
        onDataUpdate(page);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId, ratingType]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    const next = pageIndex + 1;
    setLoadingMore(true);
    try {
      const page = await fetchEventRating(eventId, ratingType, next, PAGE_SIZE);
      setData(prev => ({
        ...page,
        items: [...prev.items, ...page.items],
      }));
      setPageIndex(next);
    } catch {}
    finally { setLoadingMore(false); }
  }, [eventId, ratingType, pageIndex]);

  const handleEdit = useCallback(() => {
    if (!myItem) return;
    setVoteValue(myItem.value);
    setComment(myItem.comment);
    setEditingId(myItem.id);
    setShowForm(true);
  }, [myItem]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setVoteValue(0);
    setComment('');
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!accountId || voteValue === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await voteEventRating({ id: editingId ?? undefined, accountId, eventId, comment, value: voteValue, ratingType });
      const updated = await fetchEventRating(eventId, ratingType, 0, PAGE_SIZE);
      setData(updated);
      setPageIndex(1);
      onDataUpdate(updated);
      setShowForm(false);
      setEditingId(null);
      setVoteValue(0);
      setComment('');
    } catch (e: any) {
      setSubmitError(e?.serverMessage ?? e?.message ?? 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  }, [accountId, eventId, comment, voteValue, ratingType, editingId, onDataUpdate]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>

        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{label}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.modalSummary}>
          {score > 0 && <GradeBadge score={score} size="lg" />}
          <div className={styles.summaryRight}>
            {score > 0
              ? <span className={styles.summaryScore}>{score.toFixed(1)}</span>
              : <span className={styles.summaryNoScore}>Нет оценок</span>}
            {data.total > 0 && (
              <span className={styles.summaryCount}>{data.total} {pluralVotes(data.total)}</span>
            )}
          </div>
        </div>

        <div className={styles.modalList}>
          {loading ? (
            <div className={styles.emptyState}>Загрузка...</div>
          ) : data.items.length === 0 ? (
            <div className={styles.emptyState}>Пока никто не оставил оценку</div>
          ) : (
            data.items.map(item => <RatingItemRow key={item.id} item={item} />)
          )}
          {!loading && hasMore && (
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
            </button>
          )}
        </div>

        {accountId && (
          <div className={styles.modalFooter}>
            {!showForm ? (
              <button
                className={styles.leaveReviewBtn}
                onClick={voted ? handleEdit : () => setShowForm(true)}
              >
                {voted ? 'Редактировать отзыв' : 'Оставить отзыв'}
              </button>
            ) : (
              <div className={styles.voteForm}>
                <div className={styles.voteFormLabel}>{editingId ? 'Редактировать оценку' : 'Ваша оценка'}</div>
                <GradePicker value={voteValue} onChange={setVoteValue} />
                <textarea
                  className={styles.commentArea}
                  placeholder="Комментарий (необязательно)"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                {submitError && <div className={styles.voteError}>{submitError}</div>}
                <div className={styles.voteFormBtns}>
                  <button className={styles.cancelBtn} onClick={handleCancel}>Отмена</button>
                  <button
                    className={styles.submitBtn}
                    disabled={voteValue === 0 || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? 'Отправка...' : editingId ? 'Сохранить' : 'Отправить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}

// ── Badge (entry point) ───────────────────────────────────────────────────────

export function RatingWidget({ eventId, eventStartTime, accountId }: WidgetProps) {
  const ratingType = getRatingType(eventStartTime);

  const [data,      setData]      = useState<IRatingPage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchEventRating(eventId, ratingType)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, resultRating: 0 }));
  }, [eventId, ratingType]);

  if (!data) return null;

  const score = data.resultRating;

  return (
    <>
      <button className={styles.badge} onClick={() => setModalOpen(true)} title="Рейтинг">
        {score > 0
          ? <>
              <GradeBadge score={score} size="sm" />
              <span className={styles.badgeScore}>{score.toFixed(1)}</span>
              {data.total > 0 && <span className={styles.badgeCount}>({data.total})</span>}
            </>
          : <span className={styles.badgeEmpty}>Оценить</span>
        }
      </button>

      {modalOpen && (
        <RatingModal
          eventId={eventId}
          ratingType={ratingType}
          accountId={accountId}
          initialData={data}
          onClose={() => setModalOpen(false)}
          onDataUpdate={setData}
        />
      )}
    </>
  );
}

function pluralVotes(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'оценок';
  if (mod10 === 1) return 'оценка';
  if (mod10 >= 2 && mod10 <= 4) return 'оценки';
  return 'оценок';
}
