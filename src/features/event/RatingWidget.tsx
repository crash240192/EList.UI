// features/event/RatingWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import { fetchEventRating, voteEventRating, deleteEventRating, RATING_COMMENT_MAX_LENGTH } from '@/entities/event';
import type { IRatingItem, IRatingPage, RatingType } from '@/entities/event';
import { getEventRatingGrade } from '@/shared/lib/eventRatingGrade';
import { clampText, textLengthError } from '@/shared/lib/clampText';
import { TextLengthHint } from '@/shared/ui/TextLengthHint/TextLengthHint';
import { GradeBadge } from '@/shared/ui/GradeBadge/GradeBadge';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import styles from './RatingWidget.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';

interface WidgetProps {
  eventId: string;
  eventStartTime: string;
  eventEndTime?: string | null;
  accountId: string | null;
  /** false — мероприятие отменено, новые оценки запрещены */
  eventActive?: boolean;
}

function getRatingType(startTime: string): RatingType {
  return new Date(startTime) <= new Date() ? 'Summary' : 'Expectation';
}

/** Мероприятие уже завершилось (по endTime или по startTime, если конца нет) */
export function isEventFinished(startTime: string, endTime?: string | null): boolean {
  const deadline = endTime ? new Date(endTime) : new Date(startTime);
  return deadline.getTime() <= Date.now();
}

function GradePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.gradePicker}>
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          className={`${styles.gpItem} ${value === v ? styles.gpSelected : ''}`}
          onClick={() => onChange(value === v ? 0 : v)}
          title={getEventRatingGrade(v).label}
        >
          <GradeBadge score={v} size="sm" simple />
          <span className={styles.gpNum}>{v}</span>
        </button>
      ))}
    </div>
  );
}

function ratingAuthorName(item: IRatingItem): string {
  return item.personInfo?.firstName
    ? `${item.personInfo.firstName} ${item.personInfo.lastName ?? ''}`.trim()
    : item.account.login;
}

function ratingAuthorInitials(item: IRatingItem): string {
  const pi = item.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return item.account.login[0]?.toUpperCase() ?? '?';
}

interface RatingItemRowProps {
  item: IRatingItem;
  isOwn?: boolean;
  canDelete?: boolean;
  deleteDisabled?: boolean;
  onDeleteClick?: () => void;
}

function RatingItemRow({ item, isOwn, canDelete, deleteDisabled, onDeleteClick }: RatingItemRowProps) {
  const name = ratingAuthorName(item);
  const hasComment = !!item.comment?.trim();
  const showDelete = isOwn && canDelete;

  return (
    <article className={`${styles.ratingItem} ${isOwn ? styles.ratingItemOwn : ''}`}>
      <div className={styles.ratingItemTop}>
        <UserAvatar
          accountId={item.accountId}
          avatarId={item.account.avatarId ?? null}
          initials={ratingAuthorInitials(item)}
          size={30}
          className={styles.ratingItemAvatar}
        />

        <div className={styles.ratingItemMeta}>
          <span className={styles.ratingItemName}>{name}</span>
          {isOwn && <span className={styles.ratingItemYou}>Вы</span>}
        </div>

        <div className={styles.ratingItemEnd}>
          {item.value > 0 && <GradeBadge score={item.value} size="xs" simple />}
          {showDelete && (
            <button
              type="button"
              className={styles.ratingDeleteBtn}
              disabled={deleteDisabled}
              aria-label="Удалить оценку"
              title="Удалить оценку"
              onClick={onDeleteClick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {hasComment && (
        <>
          <div className={styles.ratingItemDivider} aria-hidden />
          <p className={styles.ratingItemComment}>{item.comment}</p>
        </>
      )}
    </article>
  );
}

interface ModalProps {
  eventId: string;
  ratingType: RatingType;
  eventStartTime: string;
  eventEndTime?: string | null;
  eventActive: boolean;
  accountId: string | null;
  initialData: IRatingPage;
  allowVote: boolean;
  allowDelete: boolean;
  onClose: () => void;
  onDataUpdate: (d: IRatingPage) => void;
}

const PAGE_SIZE = 20;

function RatingModal({
  eventId,
  ratingType,
  eventStartTime,
  eventEndTime,
  eventActive,
  accountId,
  initialData,
  allowVote,
  allowDelete,
  onClose,
  onDataUpdate,
}: ModalProps) {
  useModalBackButton(onClose);
  const label = ratingType === 'Expectation' ? 'Рейтинг ожидания' : 'Рейтинг';
  const eventFinished = isEventFinished(eventStartTime, eventEndTime);

  const [data, setData] = useState<IRatingPage>(initialData);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voteValue, setVoteValue] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const myItem = accountId ? data.items.find(i => i.accountId === accountId) ?? null : null;
  const voted = !!myItem;
  const score = data.resultRating;
  const hasMore = data.items.length < data.total;

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
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [eventId, ratingType, pageIndex]);

  const handleEdit = useCallback(() => {
    if (!myItem) return;
    setVoteValue(myItem.value);
    setComment(clampText(myItem.comment, RATING_COMMENT_MAX_LENGTH));
    setEditingId(myItem.id);
    setShowForm(true);
  }, [myItem]);

  const handleCommentChange = useCallback((raw: string) => {
    setComment(clampText(raw, RATING_COMMENT_MAX_LENGTH));
    setSubmitError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setVoteValue(0);
    setComment('');
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!accountId || voteValue === 0) return;
    const lengthError = textLengthError(comment.length, RATING_COMMENT_MAX_LENGTH);
    if (lengthError) {
      setSubmitError(lengthError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await voteEventRating({
        id: editingId ?? undefined,
        accountId,
        eventId,
        comment,
        value: voteValue,
        ratingType,
      });
      const updated = await fetchEventRating(eventId, ratingType, 0, PAGE_SIZE);
      setData(updated);
      setPageIndex(0);
      onDataUpdate(updated);
      setShowForm(false);
      setEditingId(null);
      setVoteValue(0);
      setComment('');
    } catch (e: unknown) {
      const err = e as { serverMessage?: string; message?: string };
      setSubmitError(err?.serverMessage ?? err?.message ?? 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  }, [accountId, eventId, comment, voteValue, ratingType, editingId, onDataUpdate]);

  const performDelete = useCallback(async () => {
    if (!myItem || deleting) return;
    setDeleting(true);
    setSubmitError(null);
    try {
      await deleteEventRating(myItem.id);
      const updated = await fetchEventRating(eventId, ratingType, 0, PAGE_SIZE);
      setData(updated);
      setPageIndex(0);
      onDataUpdate(updated);
      setShowForm(false);
      setEditingId(null);
      setVoteValue(0);
      setComment('');
      setDeleteConfirmOpen(false);
    } catch (e: unknown) {
      const err = e as { serverMessage?: string; message?: string };
      setSubmitError(err?.serverMessage ?? err?.message ?? 'Не удалось удалить оценку');
    } finally {
      setDeleting(false);
    }
  }, [myItem, deleting, eventId, ratingType, onDataUpdate]);

  const openDeleteConfirm = useCallback(() => {
    if (!allowDelete || !myItem) return;
    setDeleteConfirmOpen(true);
  }, [allowDelete, myItem]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{label}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.modalSummary}>
          {score > 0 && <GradeBadge score={score} size="lg" />}
          <div className={styles.summaryRight}>
            {score > 0 ? (
              <span className={styles.summaryScore}>{score.toFixed(1)}</span>
            ) : (
              <span className={styles.summaryNoScore}>Нет оценок</span>
            )}
            {data.total > 0 && (
              <span className={styles.summaryCount}>
                {data.total} {pluralVotes(data.total)}
              </span>
            )}
          </div>
        </div>

        <div className={styles.modalList}>
          {loading ? (
            <div className={styles.emptyState}>Загрузка...</div>
          ) : data.items.length === 0 ? (
            <div className={styles.emptyState}>Пока никто не оставил оценку</div>
          ) : (
            data.items.map(item => (
              <RatingItemRow
                key={item.id}
                item={item}
                isOwn={!!accountId && item.accountId === accountId}
                canDelete={allowDelete && item.accountId === accountId}
                deleteDisabled={deleting}
                onDeleteClick={openDeleteConfirm}
              />
            ))
          )}
          {!loading && hasMore && (
            <button type="button" className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
            </button>
          )}
        </div>

        {accountId && (
          <div className={styles.modalFooter}>
            {!allowVote && !voted && (
              <p className={styles.voteDisabledHint}>
                {!eventActive
                  ? 'Мероприятие отменено — новые оценки недоступны'
                  : eventFinished
                    ? 'Мероприятие завершено — новые оценки недоступны'
                    : 'Оценки недоступны'}
              </p>
            )}
            {voted && !allowVote && !showForm && (
              <p className={styles.voteDisabledHint}>
                {!eventActive
                  ? 'Мероприятие отменено — изменить оценку нельзя'
                  : 'Мероприятие завершено — изменить или удалить оценку нельзя'}
              </p>
            )}
            {allowVote && voted && !showForm && (
              <button type="button" className={styles.leaveReviewBtn} onClick={handleEdit}>
                Редактировать отзыв
              </button>
            )}
            {allowVote && !voted && !showForm && (
              <button type="button" className={styles.leaveReviewBtn} onClick={() => setShowForm(true)}>
                Оставить отзыв
              </button>
            )}
            {showForm && (
              <div className={styles.voteForm}>
                <div className={styles.voteFormLabel}>{editingId ? 'Редактировать оценку' : 'Ваша оценка'}</div>
                <GradePicker value={voteValue} onChange={setVoteValue} />
                <textarea
                  className={styles.commentArea}
                  placeholder="Комментарий (необязательно)"
                  value={comment}
                  onChange={e => handleCommentChange(e.target.value)}
                  rows={3}
                  maxLength={RATING_COMMENT_MAX_LENGTH}
                />
                {submitError && <div className={styles.voteError}>{submitError}</div>}
                <div className={styles.voteFormBtns}>
                  <TextLengthHint
                    length={comment.length}
                    maxLength={RATING_COMMENT_MAX_LENGTH}
                    className={styles.lengthHint}
                  />
                  <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    disabled={voteValue === 0 || submitting || comment.length > RATING_COMMENT_MAX_LENGTH}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? 'Отправка...' : editingId ? 'Сохранить' : 'Отправить'}
                  </button>
                </div>
              </div>
            )}
            {submitError && !showForm && (
              <div className={styles.voteError}>{submitError}</div>
            )}
          </div>
        )}
      </div>

      {deleteConfirmOpen && (
        <ConfirmDialog
          title="Удалить оценку?"
          message="Оценка и комментарий будут удалены без возможности восстановления."
          cancelLabel="Нет"
          confirmLabel="Да"
          variant="danger"
          onCancel={() => !deleting && setDeleteConfirmOpen(false)}
          onConfirm={() => void performDelete()}
        />
      )}
    </>
  );
}

export function RatingWidget({
  eventId,
  eventStartTime,
  eventEndTime,
  accountId,
  eventActive = true,
}: WidgetProps) {
  const ratingType = getRatingType(eventStartTime);
  const eventFinished = isEventFinished(eventStartTime, eventEndTime);
  const allowVote = eventActive && !eventFinished;
  const allowDelete = allowVote;

  const [data, setData] = useState<IRatingPage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchEventRating(eventId, ratingType)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, resultRating: 0 }));
  }, [eventId, ratingType]);

  if (!data) return null;

  const score = data.resultRating;
  const hasRatings = score > 0 || data.total > 0;
  if (eventFinished && !hasRatings) return null;

  const badgeTitle = !eventActive
    ? 'Мероприятие отменено — оценки недоступны'
    : eventFinished
      ? 'Мероприятие завершено — оценки недоступны'
      : 'Рейтинг';

  return (
    <>
      <button
        type="button"
        className={`${styles.badge} ${!allowVote ? styles.badgeDisabled : ''}`}
        onClick={() => setModalOpen(true)}
        title={badgeTitle}
      >
        {score > 0 ? (
          <>
            <GradeBadge score={score} size="sm" />
            <span className={styles.badgeScore}>{score.toFixed(1)}</span>
            {data.total > 0 && <span className={styles.badgeCount}>({data.total})</span>}
          </>
        ) : (
          <span className={styles.badgeEmpty}>
            <HeartIcon />
            Оценить
          </span>
        )}
      </button>

      {modalOpen && (
        <RatingModal
          eventId={eventId}
          ratingType={ratingType}
          eventStartTime={eventStartTime}
          eventEndTime={eventEndTime}
          eventActive={eventActive}
          accountId={accountId}
          initialData={data}
          allowVote={allowVote}
          allowDelete={allowDelete}
          onClose={() => setModalOpen(false)}
          onDataUpdate={setData}
        />
      )}
    </>
  );
}

function pluralVotes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'оценок';
  if (mod10 === 1) return 'оценка';
  if (mod10 >= 2 && mod10 <= 4) return 'оценки';
  return 'оценок';
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
