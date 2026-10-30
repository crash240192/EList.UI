import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IMessage, IMessagePathNode } from '@/entities/conversation';
import { fetchMessageReplies } from '@/entities/conversation';
import { MessageRow } from './MessageRow';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import { DiscussionLoadMore } from './DiscussionLoadMore';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { useDiscussionAppend, useDiscussionRefreshActions } from './discussionRefreshContext';
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
  focusExpandIds?: string[];
  focusTargetId?: string | null;
  focusHighlightId?: string | null;
  onFocusHandled?: () => void;
  onReply?: (message: IMessage, threadRootId: string) => void;
  onDeleted?: (messageId: string) => void;
  onTotalLoaded?: (total: number) => void;
}

export function MessageReplies({
  parent,
  depth,
  refreshKey: _refreshKey,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  viewMode,
  threadRootId,
  focusPathTail,
  focusExpandIds,
  focusTargetId = null,
  focusHighlightId = null,
  onFocusHandled,
  onReply,
  onDeleted,
  onTotalLoaded,
}: MessageRepliesProps) {
  const { resetBump } = useDiscussionRefreshActions();
  const focusChild = focusPathTail?.[0];
  const focusThroughPage = focusChild?.pageIndex ?? 0;
  type ModeCache = { items: IMessage[]; total: number; loadedThroughPage: number };
  const emptyCache = (): ModeCache => ({ items: [], total: 0, loadedThroughPage: -1 });

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
  /** Кэш по виду — повторное дерево↔лента без refetch и без мигания. */
  const treeCacheRef = useRef<ModeCache | null>(null);
  const flatCacheRef = useRef<ModeCache | null>(null);
  const cacheParentIdRef = useRef(parent.id);

  const byId = useMemo(() => {
    const map = new Map<string, IMessage>();
    map.set(parent.id, parent);
    for (const item of items) map.set(item.id, item);
    return map;
  }, [parent, items]);

  const remaining = Math.max(0, total - items.length);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const applyCache = useCallback((cache: ModeCache) => {
    setItems(cache.items);
    setTotal(cache.total);
    setLoadedThroughPage(cache.loadedThroughPage);
    onTotalLoaded?.(cache.total);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
  }, [onTotalLoaded]);

  const writeModeCache = useCallback((mode: DiscussionViewMode, cache: ModeCache) => {
    if (mode === 'flat') flatCacheRef.current = cache;
    else treeCacheRef.current = cache;
  }, []);

  const fetchTreeRange = useCallback(
    async (
      fromPage: number,
      toPage: number,
      generation: number,
      mode: 'replace' | 'append' | 'soft-replace',
    ) => {
      if (toPage < fromPage) return;
      if (mode === 'replace') setLoading(true);
      else if (mode === 'append') setLoadingMore(true);

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

        let nextItems: IMessage[];
        if (mode === 'append') {
          nextItems = mergeById(itemsRef.current, localAcc);
          setItems(nextItems);
        } else {
          nextItems = mergeById([], localAcc);
          setItems(nextItems);
        }
        setTotal(nextTotal);
        onTotalLoaded?.(nextTotal);
        setLoadedThroughPage(toPage);
        setError(null);
        writeModeCache('tree', { items: nextItems, total: nextTotal, loadedThroughPage: toPage });
      } catch (e) {
        if (generation !== requestGen.current) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
        if (mode === 'replace') {
          setItems([]);
          setLoadedThroughPage(-1);
          setTotal(0);
          writeModeCache('tree', emptyCache());
        }
      } finally {
        if (generation === requestGen.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [parent.id, onTotalLoaded, writeModeCache],
  );

  const loadFlat = useCallback(async (generation: number, soft: boolean) => {
    if (!soft) setLoading(true);
    try {
      const descendants = await loadDescendantReplies(parent.id);
      if (generation !== requestGen.current) return;
      setItems(descendants);
      setTotal(descendants.length);
      onTotalLoaded?.(descendants.length);
      setLoadedThroughPage(0);
      setError(null);
      writeModeCache('flat', {
        items: descendants,
        total: descendants.length,
        loadedThroughPage: 0,
      });
    } catch (e) {
      if (generation !== requestGen.current) return;
      setError(e instanceof Error ? e.message : 'Ошибка загрузки ответов');
      if (!soft) {
        setItems([]);
        setLoadedThroughPage(-1);
        writeModeCache('flat', emptyCache());
      }
    } finally {
      if (generation === requestGen.current) setLoading(false);
    }
  }, [parent.id, onTotalLoaded, writeModeCache]);

  useEffect(() => {
    if (cacheParentIdRef.current !== parent.id) {
      cacheParentIdRef.current = parent.id;
      treeCacheRef.current = null;
      flatCacheRef.current = null;
    }

    requestGen.current += 1;
    const generation = requestGen.current;
    const cached = viewMode === 'flat' ? flatCacheRef.current : treeCacheRef.current;
    if (cached && cached.loadedThroughPage >= 0) {
      applyCache(cached);
      return;
    }

    // Первая загрузка выбранного вида: без скелетона, если на экране ещё виден другой вид.
    const soft = itemsRef.current.length > 0;
    if (viewMode === 'flat') {
      void loadFlat(generation, soft);
    } else {
      const through = Math.max(0, focusThroughPageRef.current);
      void fetchTreeRange(0, through, generation, soft ? 'soft-replace' : 'replace');
    }
    // refreshKey намеренно не в deps: отправка ответа не должна сбрасывать список
    // (новая запись приходит через useDiscussionAppend).
  }, [loadFlat, fetchTreeRange, parent.id, viewMode, applyCache]);

  useDiscussionAppend(parent.id, (message) => {
    setItems((prev) => {
      const next = mergeById(prev, [message]);
      const nextTotal = Math.max(total + 1, next.length);
      writeModeCache(viewMode, {
        items: next,
        total: nextTotal,
        loadedThroughPage: loadedThroughPage < 0 ? 0 : loadedThroughPage,
      });
      // Другой вид устарел — при следующем переключении подгрузим заново.
      if (viewMode === 'flat') treeCacheRef.current = null;
      else flatCacheRef.current = null;
      return next;
    });
    setTotal((prevTotal) => {
      const nextTotal = Math.max(prevTotal + 1, (prevTotal || 0) + 1);
      onTotalLoaded?.(nextTotal);
      return nextTotal;
    });
    setPreviewExpanded(true);
    setError(null);
  });

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
        writeModeCache(viewMode, {
          items: next,
          total: nextTotal,
          loadedThroughPage: loadedThroughPage < 0 ? 0 : loadedThroughPage,
        });
        if (viewMode === 'flat') treeCacheRef.current = null;
        else flatCacheRef.current = null;
        return nextTotal;
      });
      return next;
    });
    onDeleted?.(messageId);
  }, [onDeleted, onTotalLoaded, parent.id, resetBump, viewMode, writeModeCache, loadedThroughPage]);

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

  // Скелетон только на первичной загрузке; при смене вида список остаётся на экране.
  if (loading && items.length === 0) {
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
        const isFocusHighlight = focusHighlightId === msg.id;

        return (
          <MessageRow
            key={msg.id}
            message={msg}
            depth={childDepth}
            highlighted={activeReplyId === msg.id || isFocusHighlight}
            focusTarget={isFocusHighlight}
            activeReplyId={activeReplyId}
            currentAccountId={currentAccountId}
            conversationId={conversationId}
            viewMode={viewMode}
            threadRootId={threadRootId}
            replyToAuthor={replyToAuthor}
            autoExpandChain={autoExpandChain && msg.id === items[0]?.id}
            focusPathTail={childTail}
            focusExpandIds={focusExpandIds}
            focusTargetId={focusTargetId}
            focusHighlightId={focusHighlightId}
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
