import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import styles from './MessageReplies.module.css';

const PAGE_SIZE = 5;

interface MessageRepliesProps {
  parent: IMessage;
  depth: number;
  refreshKey: number;
  activeReplyId?: string | null;
  conversationId: string;
  currentAccountId: string | null;
  onReply: (message: IMessage) => void;
  onTotalLoaded?: (total: number) => void;
}

export function MessageReplies({
  parent,
  depth,
  refreshKey,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  onReply,
  onTotalLoaded,
}: MessageRepliesProps) {
  const [items, setItems] = useState<IMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);

  const loadPage = useCallback(
    async (pageIndex: number, append: boolean) => {
      const paged = await fetchMessageReplies(parent.id, pageIndex, PAGE_SIZE);
      const nextItems = paged.result ?? [];
      const nextTotal = paged.total ?? 0;
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setTotal(nextTotal);
      onTotalLoaded?.(nextTotal);
      setHasMore((pageIndex + 1) * PAGE_SIZE < nextTotal);
      setError(null);
    },
    [parent.id, onTotalLoaded],
  );

  useEffect(() => {
    pageRef.current = 0;
    setLoading(true);
    void loadPage(0, false)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов'))
      .finally(() => setLoading(false));
  }, [loadPage, parent.id, refreshKey]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    setLoadingMore(true);
    void loadPage(next, true).finally(() => setLoadingMore(false));
  };

  const childDepth = depth + 1;
  const remaining = Math.max(0, total - items.length);

  const showRepliesSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);
  const showMoreSpinner = useDelayedBusy(loadingMore, DISCUSSION_PRELOADER_DELAY_MS);

  if (loading) {
    return (
      <div className={styles.skeletonRoot} role="status" aria-label="Загрузка ответов">
        <DiscussionMessageSkeleton variant="replies" showSpinner={showRepliesSpinner} />
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.list}>
      {items.map((msg) => (
        <MessageRow
          key={msg.id}
          message={msg}
          depth={childDepth}
          highlighted={activeReplyId === msg.id}
          activeReplyId={activeReplyId}
          currentAccountId={currentAccountId}
          conversationId={conversationId}
          onReply={onReply}
        />
      ))}
      {hasMore && (
        <button
          type="button"
          className={`${styles.moreBtn} ${loadingMore && showMoreSpinner ? styles.moreBtnLoading : ''}`}
          disabled={loadingMore}
          onClick={loadMore}
          aria-busy={loadingMore}
          aria-label={loadingMore ? 'Загрузка' : undefined}
        >
          {loadingMore && showMoreSpinner ? (
            <AppPreloader size="sm" layout="inline" role="none" />
          ) : (
            `Загрузить ещё (${remaining})`
          )}
        </button>
      )}
    </div>
  );
}
