import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import styles from './DiscussionMessageSkeleton.module.css';

interface DiscussionMessageSkeletonProps {
  /** Кольцевой прелоадер — обычно после useDelayedBusy */
  showSpinner?: boolean;
  variant?: 'thread' | 'replies';
}

export function DiscussionMessageSkeleton({
  showSpinner = false,
  variant = 'thread',
}: DiscussionMessageSkeletonProps) {
  const wrapClass = variant === 'replies' ? `${styles.wrap} ${styles.replies}` : styles.wrap;

  return (
    <div className={wrapClass}>
      <div className={styles.card}>
        <div className={styles.cardInner}>
          <div className={styles.avatarStub} />
          <div className={styles.content}>
            <div className={styles.headRow}>
              <div className={styles.authorStub} />
              <div className={styles.timeStub} />
            </div>
            <div className={styles.body}>
              {showSpinner ? (
                <div className={styles.spinnerSlot}>
                  <AppPreloader size="sm" layout="inline" role="presentation" />
                </div>
              ) : (
                <>
                  <div className={styles.stubLineWide} />
                  <div className={styles.stubLineMid} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
