// features/event/RatingSection.tsx

import { useState, useEffect, useCallback } from 'react';
import { fetchEventRating, voteEventRating } from '@/entities/event';
import type { IRatingItem, IRatingPage, RatingType } from '@/entities/event';
import styles from './RatingSection.module.css';

interface Props {
  eventId: string;
  eventStartTime: string;
  accountId: string | null;
}

function getRatingType(startTime: string): RatingType {
  return new Date(startTime) <= new Date() ? 'Summary' : 'Expectation';
}

function StarRow({ value, interactive, onChange }: {
  value: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = interactive ? (hovered || value) : value;
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg
          key={n}
          className={`${styles.star} ${n <= active ? styles.starFilled : ''} ${interactive ? styles.starInteractive : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
          onMouseEnter={interactive ? () => setHovered(n) : undefined}
          onMouseLeave={interactive ? () => setHovered(0) : undefined}
          onClick={interactive ? () => onChange?.(n) : undefined}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

function RatingItemRow({ item }: { item: IRatingItem }) {
  const name = item.personInfo?.firstName
    ? `${item.personInfo.firstName} ${item.personInfo.lastName ?? ''}`.trim()
    : item.account.login;
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <div className={styles.ratingItem}>
      <div className={styles.ratingItemHeader}>
        <div className={styles.ratingItemAvatar}>{initial}</div>
        <div className={styles.ratingItemMeta}>
          <span className={styles.ratingItemName}>{name}</span>
          <StarRow value={item.value} />
        </div>
      </div>
      {item.comment && <p className={styles.ratingItemComment}>{item.comment}</p>}
    </div>
  );
}

export function RatingSection({ eventId, eventStartTime, accountId }: Props) {
  const ratingType = getRatingType(eventStartTime);
  const label = ratingType === 'Expectation' ? 'Рейтинг ожидания' : 'Рейтинг';

  const [data,        setData]        = useState<IRatingPage | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [voted,       setVoted]       = useState(false);

  const [starValue, setStarValue] = useState(0);
  const [comment,   setComment]   = useState('');

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    fetchEventRating(eventId, ratingType)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, resultRating: 0 }))
      .finally(() => setLoading(false));
  }, [eventId, ratingType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (accountId && data) {
      setVoted(data.items.some(i => i.accountId === accountId));
    }
  }, [data, accountId]);

  const handleSubmit = useCallback(async () => {
    if (!accountId || starValue === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await voteEventRating({ accountId, eventId, comment, value: starValue, ratingType });
      setVoted(true);
      setComment('');
      setStarValue(0);
      load();
    } catch (e: any) {
      setSubmitError(e?.serverMessage ?? e?.message ?? 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  }, [accountId, eventId, comment, starValue, ratingType, load]);

  return (
    <div className={styles.section}>
      <div className={styles.secLabel}>{label}</div>

      {loading ? (
        <div className={styles.loadingRow}>
          <div className={styles.skeletonLine} style={{ width: '50%' }} />
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <span className={styles.summaryScore}>
              {data && data.resultRating > 0 ? data.resultRating.toFixed(1) : '—'}
            </span>
            <div className={styles.summaryRight}>
              <StarRow value={Math.round(data?.resultRating ?? 0)} />
              <span className={styles.summaryCount}>
                {data?.total
                  ? `${data.total} ${pluralVotes(data.total)}`
                  : 'Нет оценок'}
              </span>
            </div>
          </div>

          {accountId && !voted && (
            <div className={styles.voteForm}>
              <div className={styles.voteFormLabel}>Ваша оценка</div>
              <StarRow value={starValue} interactive onChange={setStarValue} />
              <textarea
                className={styles.commentArea}
                placeholder="Комментарий (необязательно)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                maxLength={500}
              />
              {submitError && <div className={styles.voteError}>{submitError}</div>}
              <button
                className={styles.voteBtn}
                disabled={starValue === 0 || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Отправка...' : 'Оценить'}
              </button>
            </div>
          )}

          {accountId && voted && (
            <div className={styles.votedBadge}>✓ Вы уже оценили это мероприятие</div>
          )}

          {(data?.items.length ?? 0) > 0 && (
            <div className={styles.list}>
              {data!.items.map(item => (
                <RatingItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
