import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IMessage, IMessagePathNode } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import { DiscussionPager } from './DiscussionPager';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { useDiscussionRefreshActions } from './discussionRefreshContext';
import {
  DISCUSSION_REPLY_PREVIEW_COUNT,
  DISCUSSION_TREE_INDENT_CAP,
  DISCUSSION_TREE_SIBLING_PAGE_SIZE,
  discussionTotalPages,
  type DiscussionViewMode,
} from './discussionViewMode';
import { loadDescendantReplies } from './loadDescendantReplies';
import { messageAuthorName } from './messageUtils';
import styles from './MessageReplies.module.css';

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
  /** Путь от прямого ребёнка к цели deep-link */
  focusPathTail?: IMessagePathNode[];
  focusTargetId?: string | null;
  onFocusHandled?: () => void;
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
  focusPathTail,
  focusTargetId = null,
  onFocusHandled,
  onReply,
  onDeleted,
  onTotalLoaded,
}: MessageRepliesProps) {
  const { resetBump } = useDiscussionRefreshActions();
  const focusChild = focusPathTail?.[0];
  const focusInitialPage = focusChild?.pageIndex ?? 0;
  const [items, setItems] = useState<IMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(focusInitialPage);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** В ленте под корнем — превью первой порции */
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const requestGen = useRef(0);
  const focusInitialPageRef = useRef(focusInitialPage);
  focusInitialPageRef.current = focusInitialPage;

  const byId = useMemo(() => {
    const map = new Map<string, IMessage>();
    map.set(parent.id, parent);
    for (const item of items) map.set(item.id, item);
    return map;
  }, [parent, items]);

  const totalPages = discussionTotalPages(total, DISCUSSION_TREE_SIBLING_PAGE_SIZE);

  const loadTreePage = useCallback(
    async (nextPage: number, generation: number, initial: boolean) => {
      if (initial) setLoading(true);
      else setPageLoading(true);
      try {
        const paged = await fetchMessageReplies(
          parent.id,
          nextPage,
          DISCUSSION_TREE_SIBLING_PAGE_SIZE,
        );
        if (generation !== requestGen.current) return;

        const nextItems = paged.result ?? [];
        const nextTotal = paged.total ?? 0;
        const maxPage = Math.max(0, discussionTotalPages(nextTotal, DISCUSSION_TREE_SIBLING_PAGE_SIZE) - 1);
        const safePage = Math.min(nextPage, maxPage);

        if (safePage !== nextPage && nextTotal > 0) {
          const last = await fetchMessageReplies(
            parent.id,
            safePage,
            DISCUSSION_TREE_SIBLING_PAGE_SIZE,
          );
          if (generation !== requestGen.current) return;
          setItems(last.result ?? []);
          setTotal(last.total ?? 0);
          onTotalLoaded?.(last.total ?? 0);
          setPageIndex(safePage);
        } else {
          setItems(nextItems);
          setTotal(nextTotal);
          onTotalLoaded?.(nextTotal);
          setPageIndex(safePage);
        }
        setError(null);
      } catch (e) {
        if (generation !== requestGen.current) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
        if (initial) setItems([]);
      } finally {
        if (generation === requestGen.current) {
          setLoading(false);
          setPageLoading(false);
        }
      }
    },
    [parent.id, onTotalLoaded],
  );

  const loadFlat = useCallback(async (generation: number) => {
    setLoading(true);
    try {
      const descendants = await loadDescendantReplies(parent.id);
      if (generation !== requestGen.current) return;
      setItems(descendants);
      setTotal(descendants.length);
      onTotalLoaded?.(descendants.length);
      setPageIndex(0);
      setError(null);
    } catch (e) {
      if (generation !== requestGen.current) return;
      setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
      setItems([]);
    } finally {
      if (generation === requestGen.current) setLoading(false);
    }
  }, [parent.id, onTotalLoaded]);

  useEffect(() => {
    requestGen.current += 1;
    const generation = requestGen.current;
    setPreviewExpanded(Boolean(focusChild));
    const startPage = Math.max(0, focusInitialPageRef.current);
    setPageIndex(startPage);
    if (viewMode === 'flat') {
      void loadFlat(generation);
    } else {
      void loadTreePage(startPage, generation, true);
    }
  }, [loadFlat, loadTreePage, parent.id, refreshKey, viewMode, focusChild?.messageId]);

  const goToPage = useCallback((nextPage: number) => {
    if (viewMode === 'flat' || loading || pageLoading) return;
    const generation = requestGen.current;
    void loadTreePage(nextPage, generation, false);
  }, [loadTreePage, loading, pageLoading, viewMode]);

  const handleDeleted = useCallback((messageId: string) => {
    setItems((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      setTotal((prevTotal) => {
        const nextTotal = Math.max(0, prevTotal - 1);
        onTotalLoaded?.(nextTotal);
        if (nextTotal === 0) resetBump(parent.id);
        return nextTotal;
      });
      return next;
    });
    onDeleted?.(messageId);
  }, [onDeleted, onTotalLoaded, parent.id, resetBump]);

  const childDepth = depth + 1;
  const nestIndent = viewMode === 'flat' || childDepth <= DISCUSSION_TREE_INDENT_CAP;

  /** Превью только в ленте под корнем */
  const useFlatPreview = viewMode === 'flat' && depth === 0;
  const visibleItems =
    useFlatPreview && !previewExpanded
      ? items.slice(0, DISCUSSION_REPLY_PREVIEW_COUNT)
      : items;
  const hiddenFlatTotal =
    useFlatPreview && !previewExpanded
      ? Math.max(0, total - DISCUSSION_REPLY_PREVIEW_COUNT)
      : 0;

  /**
   * Автоцепочка: у родителя ровно один прямой ответ с продолжением —
   * сразу раскрываем его (до развилки / конца).
   */
  const autoExpandChain =
    viewMode === 'tree'
    && total === 1
    && items.length === 1
    && Boolean(items[0]?.replied);

  const showRepliesSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);

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
          viewMode === 'flat'
          && msg.replyTo
          && msg.replyTo !== threadRootId
          && parentMsg
            ? messageAuthorName(parentMsg)
            : null;
        const onFocusPath = Boolean(focusChild && focusChild.messageId === msg.id);
        const childTail = onFocusPath ? focusPathTail?.slice(1) : undefined;

        return (
          <MessageRow
            key={msg.id}
            message={msg}
            depth={childDepth}
            highlighted={activeReplyId === msg.id || focusTargetId === msg.id}
            focusTarget={focusTargetId === msg.id}
            activeReplyId={activeReplyId}
            currentAccountId={currentAccountId}
            conversationId={conversationId}
            viewMode={viewMode}
            threadRootId={threadRootId}
            replyToAuthor={replyToAuthor}
            autoExpandChain={autoExpandChain && msg.id === items[0]?.id}
            focusPathTail={childTail}
            focusTargetId={focusTargetId}
            onFocusHandled={onFocusHandled}
            onReply={onReply}
            onDeleted={handleDeleted}
          />
        );
      })}
      {hiddenFlatTotal > 0 && (
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => setPreviewExpanded(true)}
        >
          {`Ещё ответы (${hiddenFlatTotal})`}
        </button>
      )}
      {viewMode === 'tree' && (
        <DiscussionPager
          pageIndex={pageIndex}
          totalPages={totalPages}
          totalItems={total}
          disabled={pageLoading}
          label="Ответы"
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}
