import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchConversationRootMessages } from '@/entities/conversation';
import { DISCUSSION_ROOT_PAGE_SIZE } from './discussionViewMode';

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

export function useRootMessages(
  conversationId: string | null,
  options?: {
    /**
     * Deep-link: сразу подтянуть страницы API 0…N, чтобы целевой корень
     * оказался в непрерывной ленте (без прыжка на «страницу N»).
     */
    loadThroughPage?: number;
  },
) {
  const loadThroughPage = Math.max(0, options?.loadThroughPage ?? 0);
  const loadThroughPageRef = useRef(loadThroughPage);
  loadThroughPageRef.current = loadThroughPage;

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedThroughPage, setLoadedThroughPage] = useState(-1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const hasMore = messages.length < total;

  const fetchPageRange = useCallback(
    async (
      fromPage: number,
      toPage: number,
      generation: number,
      mode: 'replace' | 'append',
    ) => {
      if (!conversationId || toPage < fromPage) return;

      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);

      try {
        const localAcc: IMessage[] = [];
        let nextTotal = 0;

        for (let page = fromPage; page <= toPage; page += 1) {
          const paged = await fetchConversationRootMessages(
            conversationId,
            page,
            DISCUSSION_ROOT_PAGE_SIZE,
          );
          if (generation !== generationRef.current) return;

          nextTotal = paged.total ?? 0;
          localAcc.push(...(paged.result ?? []));

          if ((paged.result?.length ?? 0) === 0) break;
        }

        if (generation !== generationRef.current) return;

        if (mode === 'replace') {
          setMessages(mergeById([], localAcc));
        } else {
          setMessages((prev) => mergeById(prev, localAcc));
        }
        setTotal(nextTotal);
        setLoadedThroughPage(toPage);
        setError(null);
      } catch (e) {
        if (generation !== generationRef.current) return;
        setError(e instanceof Error ? e.message : 'Не удалось загрузить сообщения');
        if (mode === 'replace') {
          setMessages([]);
          setLoadedThroughPage(-1);
          setTotal(0);
        }
      } finally {
        if (generation === generationRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [conversationId],
  );

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    if (!conversationId) {
      setMessages([]);
      setTotal(0);
      setLoadedThroughPage(-1);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const through = loadThroughPageRef.current;
    void fetchPageRange(0, through, generation, 'replace');
  }, [conversationId, fetchPageRange]);

  // Deep-link: если целевая страница глубже уже загруженной — дотянуть хвост
  useEffect(() => {
    if (!conversationId || loading || loadingMore) return;
    if (loadedThroughPage < 0) return;
    if (loadThroughPage <= loadedThroughPage) return;

    const generation = generationRef.current;
    void fetchPageRange(loadedThroughPage + 1, loadThroughPage, generation, 'append');
  }, [
    conversationId,
    loadThroughPage,
    loadedThroughPage,
    loading,
    loadingMore,
    fetchPageRange,
  ]);

  const loadMore = useCallback(() => {
    if (!conversationId || loading || loadingMore || !hasMore) return;
    const nextPage = loadedThroughPage + 1;
    if (nextPage < 0) return;
    const generation = generationRef.current;
    void fetchPageRange(nextPage, nextPage, generation, 'append');
  }, [
    conversationId,
    loading,
    loadingMore,
    hasMore,
    loadedThroughPage,
    fetchPageRange,
  ]);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    const through = Math.max(0, loadedThroughPage, loadThroughPageRef.current);
    void fetchPageRange(0, through, generation, 'replace');
  }, [conversationId, loadedThroughPage, fetchPageRange]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      setTotal((t) => Math.max(0, t - 1));
      return next;
    });
  }, []);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    remaining: Math.max(0, total - messages.length),
    total,
    error,
    loadMore,
    refresh,
    removeMessage,
  };
}
