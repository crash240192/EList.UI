import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import styles from './MessageReplies.module.css';

const PAGE_SIZE = 15;

interface MessageRepliesProps {
  parent: IMessage;
  conversationId: string;
  currentAccountId: string | null;
  onReply: (message: IMessage) => void;
}

export function MessageReplies({ parent, conversationId, currentAccountId, onReply }: MessageRepliesProps) {
  const [items, setItems] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);

  const load = useCallback(async (pageIndex: number, append: boolean) => {
    const paged = await fetchMessageReplies(parent.id, pageIndex, PAGE_SIZE);
    setItems((prev) => (append ? [...prev, ...(paged.result ?? [])] : (paged.result ?? [])));
    setHasMore((pageIndex + 1) * PAGE_SIZE < (paged.total ?? 0));
    setError(null);
  }, [parent.id]);

  useEffect(() => {
    pageRef.current = 0;
    setLoading(true);
    void load(0, false)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов'))
      .finally(() => setLoading(false));
  }, [load, parent.id]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    setLoadingMore(true);
    void load(next, true).finally(() => setLoadingMore(false));
  };

  if (loading) return <div className={styles.hint}>Загрузка ответов…</div>;

  if (error) return <div className={styles.error}>{error}</div>;

  if (items.length === 0) return <div className={styles.hint}>Пока нет ответов</div>;

  return (
    <div className={styles.list}>
      {items.map((msg) => (
        <MessageRow
          key={msg.id}
          message={msg}
          depth={1}
          currentAccountId={currentAccountId}
          conversationId={conversationId}
          onReply={onReply}
        />
      ))}
      {hasMore && (
        <button type="button" className={styles.moreBtn} disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Загрузка…' : 'Ещё ответы'}
        </button>
      )}
    </div>
  );
}
