// features/notifications/NotificationRatingPreview.tsx

import type { INotificationRatingData } from '@/entities/notification/types';
import { GradeBadge } from '@/shared/ui/GradeBadge/GradeBadge';
import styles from './NotificationRatingPreview.module.css';

interface NotificationRatingPreviewProps {
  rating: INotificationRatingData;
}

/** Оценка в уведомлении — те же буквы A–F, что и в списке оценок мероприятия */
export function NotificationRatingPreview({ rating }: NotificationRatingPreviewProps) {
  const hasComment = !!rating.comment?.trim();
  const hasValue = rating.value > 0;

  if (!hasValue && !hasComment) return null;

  return (
    <div
      className={`${styles.root} ${hasComment ? styles.hasComment : styles.noComment}`}
    >
      {hasComment ? (
        <>
          {hasValue && <GradeBadge score={rating.value} size="xs" simple />}
          <p className={styles.comment}>{rating.comment}</p>
        </>
      ) : (
        hasValue && <GradeBadge score={rating.value} size="xs" simple />
      )}
    </div>
  );
}
