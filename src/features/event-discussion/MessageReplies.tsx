import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import styles from './MessageReplies.module.css';

const PREVIEW_SIZE = 5;

interface MessageRepliesProps {
  parent: IMessage;
  depth: number;
  conversationId: string;
  currentAccountId: string | null;
  onReply: (message: IMessage) => void;
}

export function MessageReplies({
  parent,
  depth,
  conversationId,
  currentAccountId,
  onReply,
}: MessageRepliesProps) {
  const [items, setItems] = useState<IMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parentIdRef = useRef(parent.id);

  const loadPreview = useCallback(async () => {
    const paged = await fetchMessageReplies(parent.id, 0, PREVIEW_SIZE);
    setItems(paged.result ?? []);
    setTotal(paged.total ?? 0);
    setShowAll((paged.total ?? 0) <= PREVIEW_SIZE);
    setError(null);
  }, [parent.id]);

  useEffect(() => {
    parentIdRef.current = parent.id;
    setShowAll(false);
    setLoading(true);
    void loadPreview()
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов'))
      .finally(() => setLoading(false));
  }, [loadPreview, parent.id]);

  const loadAllReplies = async () => {
    if (loadingAll || showAll || total <= PREVIEW_SIZE) return;
    setLoadingAll(true);
    try {
      const paged = await fetchMessageReplies(parent.id, 0, total);
      if (parentIdRef.current !== parent.id) return;
      setItems(paged.result ?? []);
      setShowAll(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
    } finally {
      setLoadingAll(false);
    }
  };

  const childDepth = depth + 1;

  if (loading) return <div className={styles.hint}>Загрузка ответов…</div>;

  if (error) return <div className={styles.error}>{error}</div>;

  if (items.length === 0) return <div className={styles.hint}>Пока нет ответов</div>;

  return (
    <div className={styles.list}>
      {items.map((msg) => (
        <MessageRow
          key={msg.id}
          message={msg}
          depth={childDepth}
          currentAccountId={currentAccountId}
          conversationId={conversationId}
          onReply={onReply}
        />
      ))}
      {!showAll && total > PREVIEW_SIZE && (
        <button
          type="button"
          className={styles.moreBtn}
          disabled={loadingAll}
          onClick={() => void loadAllReplies()}
        >
          {loadingAll ? 'Загрузка…' : 'Показать все ответы'}
        </button>
      )}
    </div>
  );
}
