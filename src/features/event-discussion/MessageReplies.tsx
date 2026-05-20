import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
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
}

export function MessageReplies({
  parent,
  depth,
  refreshKey,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  onReply,
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
      setHasMore((pageIndex + 1) * PAGE_SIZE < nextTotal);
      setError(null);
    },
    [parent.id],
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

  if (loading) {
    return <div className={styles.hint}>Загрузка ответов…</div>;
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
        <button type="button" className={styles.moreBtn} disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Загрузка…' : `Загрузить ещё (${remaining})`}
        </button>
      )}
    </div>
  );
}
