import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import styles from './EventDiscussionsPanelSkeleton.module.css';

interface EventDiscussionsPanelSkeletonProps {
  showSpinner: boolean;
}

export function EventDiscussionsPanelSkeleton({ showSpinner }: EventDiscussionsPanelSkeletonProps) {
  return (
    <div className={styles.root}>
      <div className={styles.tabsRow} aria-hidden>
        <div className={styles.tabStub} />
        <div className={styles.tabStub} />
        <div className={styles.tabStubNarrow} />
      </div>
      <div className={styles.body}>
        <DiscussionMessageSkeleton variant="thread" showSpinner={showSpinner} />
      </div>
    </div>
  );
}
