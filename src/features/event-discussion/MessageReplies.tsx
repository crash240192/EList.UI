import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IMessage, IMessagePathNode } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import { DiscussionLoadMore } from './DiscussionLoadMore';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { useDiscussionRefreshActions } from './discussionRefreshContext';
import {
  DISCUSSION_REPLY_PREVIEW_COUNT,
  DISCUSSION_TREE_INDENT_CAP,
  DISCUSSION_TREE_SIBLING_PAGE_SIZE,
  type DiscussionViewMode,
} from './discussionViewMode';
import { loadDescendantReplies } from './loadDescendantReplies';
import { messageAuthorName } from './messageUtils';
import styles from './MessageReplies.module.css';

function mergeById(existing: IMessage[], incoming: IMessage[]): IMessage[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const next = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

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
  const focusThroughPage = focusChild?.pageIndex ?? 0;
  const [items, setItems] = useState<IMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedThroughPage, setLoadedThroughPage] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** В ленте под корнем — превью первой порции */
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const requestGen = useRef(0);
  const focusThroughPageRef = useRef(focusThroughPage);
  focusThroughPageRef.current = focusThroughPage;

  const byId = useMemo(() => {
    const map = new Map<string, IMessage>();
    map.set(parent.id, parent);
    for (const item of items) map.set(item.id, item);
    return map;
  }, [parent, items]);

  const remaining = Math.max(0, total - items.length);

  const fetchTreeRange = useCallback(
    async (
      fromPage: number,
      toPage: number,
      generation: number,
      mode: 'replace' | 'append',
    ) => {
      if (toPage < fromPage) return;
      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);

      try {
        const localAcc: IMessage[] = [];
        let nextTotal = 0;

        for (let page = fromPage; page <= toPage; page += 1) {
          const paged = await fetchMessageReplies(
            parent.id,
            page,
            DISCUSSION_TREE_SIBLING_PAGE_SIZE,
          );
          if (generation !== requestGen.current) return;
          nextTotal = paged.total ?? 0;
          localAcc.push(...(paged.result ?? []));
          if ((paged.result?.length ?? 0) === 0) break;
        }

        if (generation !== requestGen.current) return;

        if (mode === 'replace') {
          setItems(mergeById([], localAcc));
        } else {
          setItems((prev) => mergeById(prev, localAcc));
        }
        setTotal(nextTotal);
        onTotalLoaded?.(nextTotal);
        setLoadedThroughPage(toPage);
        setError(null);
      } catch (e) {
        if (generation !== requestGen.current) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
        if (mode === 'replace') {
          setItems([]);
          setLoadedThroughPage(-1);
          setTotal(0);
        }
      } finally {
        if (generation === requestGen.current) {
          setLoading(false);
          setLoadingMore(false);
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
      setLoadedThroughPage(0);
      setError(null);
    } catch (e) {
      if (generation !== requestGen.current) return;
      setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
      setItems([]);
      setLoadedThroughPage(-1);
    } finally {
      if (generation === requestGen.current) setLoading(false);
    }
  }, [parent.id, onTotalLoaded]);

  useEffect(() => {
    requestGen.current += 1;
    const generation = requestGen.current;
    setLoadedThroughPage(-1);
    if (viewMode === 'flat') {
      void loadFlat(generation);
    } else {
      const through = Math.max(0, focusThroughPageRef.current);
      void fetchTreeRange(0, through, generation, 'replace');
    }
    // focusChild намеренно не в deps: очистка deep-link не должна сбрасывать уже
    // загруженное дерево (иначе скелетон + свёрнутые ветки на медленной сети).
    // Догрузка до страницы цели — в эффекте ниже по focusThroughPage.
  }, [loadFlat, fetchTreeRange, parent.id, refreshKey, viewMode]);

  useEffect(() => {
    if (focusChild) setPreviewExpanded(true);
  }, [focusChild]);

  // Deep-link: дотянуть сиблингов до страницы цели
  useEffect(() => {
    if (viewMode !== 'tree') return;
    if (loading || loadingMore) return;
    if (loadedThroughPage < 0) return;
    if (focusThroughPage <= loadedThroughPage) return;

    const generation = requestGen.current;
    void fetchTreeRange(loadedThroughPage + 1, focusThroughPage, generation, 'append');
  }, [
    viewMode,
    loading,
    loadingMore,
    loadedThroughPage,
    focusThroughPage,
    fetchTreeRange,
  ]);

  const loadMore = useCallback(() => {
    if (viewMode === 'flat' || loading || loadingMore || remaining <= 0) return;
    const nextPage = loadedThroughPage + 1;
    if (nextPage < 0) return;
    const generation = requestGen.current;
    void fetchTreeRange(nextPage, nextPage, generation, 'append');
  }, [viewMode, loading, loadingMore, remaining, loadedThroughPage, fetchTreeRange]);

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
        <DiscussionLoadMore
          remaining={remaining}
          loading={loadingMore}
          label="Ещё ответы"
          onLoadMore={loadMore}
        />
      )}
    </div>
  );
}
