import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import { useDiscussionRefreshActions } from './discussionRefreshContext';
import {
  DISCUSSION_REPLY_PREVIEW_COUNT,
  DISCUSSION_TREE_INDENT_CAP,
  type DiscussionViewMode,
} from './discussionViewMode';
import { loadDescendantReplies } from './loadDescendantReplies';
import { messageAuthorName } from './messageUtils';
import styles from './MessageReplies.module.css';

const PAGE_SIZE = 5;

interface MessageRepliesProps {
  parent: IMessage;
  depth: number;
  refreshKey: number;
  activeReplyId?: string | null;
  conversationId: string;
  currentAccountId: string | null;
  viewMode: DiscussionViewMode;
  /** Корень ветки (для ленты и чипа «в ответ») */
  threadRootId: string;
  onReply?: (message: IMessage, threadRootId: string) => void;
  onDeleted?: (messageId: string) => void;
  onTotalLoaded?: (total: number) => void;
}

export function MessageReplies({
  parent,
  depth,
  refreshKey,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  viewMode,
  threadRootId,
  onReply,
  onDeleted,
  onTotalLoaded,
}: MessageRepliesProps) {
  const { resetBump } = useDiscussionRefreshActions();
  const [items, setItems] = useState<IMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Под корнем сначала показываем превью, остальное — по кнопке */
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const pageRef = useRef(0);

  const byId = useMemo(() => {
    const map = new Map<string, IMessage>();
    map.set(parent.id, parent);
    for (const item of items) map.set(item.id, item);
    return map;
  }, [parent, items]);

  const loadTreePage = useCallback(
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

  const loadFlat = useCallback(async () => {
    const descendants = await loadDescendantReplies(parent.id);
    setItems(descendants);
    setTotal(descendants.length);
    onTotalLoaded?.(descendants.length);
    setHasMore(false);
    setError(null);
  }, [parent.id, onTotalLoaded]);

  useEffect(() => {
    pageRef.current = 0;
    setPreviewExpanded(false);
    setLoading(true);
    const request = viewMode === 'flat' ? loadFlat() : loadTreePage(0, false);
    void request
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов'))
      .finally(() => setLoading(false));
  }, [loadFlat, loadTreePage, parent.id, refreshKey, viewMode]);

  const loadMore = () => {
    if (viewMode === 'flat' || loadingMore || !hasMore) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    setLoadingMore(true);
    void loadTreePage(next, true).finally(() => setLoadingMore(false));
  };

  const handleDeleted = useCallback((messageId: string) => {
    setItems((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      setTotal((prevTotal) => {
        const nextTotal = Math.max(0, prevTotal - 1);
        onTotalLoaded?.(nextTotal);
        setHasMore(viewMode === 'tree' && next.length < nextTotal);
        if (nextTotal === 0) resetBump(parent.id);
        return nextTotal;
      });
      return next;
    });
    onDeleted?.(messageId);
  }, [onDeleted, onTotalLoaded, parent.id, resetBump, viewMode]);

  const childDepth = depth + 1;
  /** Лента всегда с отступом (как YouTube); в дереве — с потолком глубины */
  const nestIndent = viewMode === 'flat' || childDepth <= DISCUSSION_TREE_INDENT_CAP;
  const usePreview = depth === 0;
  const visibleItems =
    usePreview && !previewExpanded
      ? items.slice(0, DISCUSSION_REPLY_PREVIEW_COUNT)
      : items;
  const hiddenTotal =
    usePreview && !previewExpanded
      ? Math.max(0, total - DISCUSSION_REPLY_PREVIEW_COUNT)
      : 0;
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
    <div className={nestIndent ? styles.list : styles.listFlush}>
      {visibleItems.map((msg) => {
        const parentMsg = msg.replyTo ? byId.get(msg.replyTo) : undefined;
        const replyToAuthor =
          viewMode === 'flat' &&
          msg.replyTo &&
          msg.replyTo !== threadRootId &&
          parentMsg
            ? messageAuthorName(parentMsg)
            : null;

        return (
          <MessageRow
            key={msg.id}
            message={msg}
            depth={childDepth}
            highlighted={activeReplyId === msg.id}
            activeReplyId={activeReplyId}
            currentAccountId={currentAccountId}
            conversationId={conversationId}
            viewMode={viewMode}
            threadRootId={threadRootId}
            replyToAuthor={replyToAuthor}
            onReply={onReply}
            onDeleted={handleDeleted}
          />
        );
      })}
      {hiddenTotal > 0 && (
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => setPreviewExpanded(true)}
        >
          {`Ещё ответы (${hiddenTotal})`}
        </button>
      )}
      {(previewExpanded || !usePreview) && hasMore && viewMode === 'tree' && (
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
