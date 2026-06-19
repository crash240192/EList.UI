import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchConversationMessages } from '@/entities/conversation';
import { filterRootMessages } from './messageUtils';

const PAGE_SIZE = 20;

export function useRootMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [remainingMore, setRemainingMore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);
  const generationRef = useRef(0);

  const loadPage = useCallback(async (pageIndex: number, append: boolean, generation: number) => {
    if (!conversationId) return;
    const paged = await fetchConversationMessages(conversationId, pageIndex, PAGE_SIZE);
    if (generation !== generationRef.current) return;

    const roots = filterRootMessages(paged.result ?? []);
    const total = paged.total ?? 0;
    const loadedThrough = (pageIndex + 1) * PAGE_SIZE;
    setMessages((prev) => (append ? [...prev, ...roots] : roots));
    setHasMore(loadedThrough < total);
    setRemainingMore(Math.max(0, Math.min(PAGE_SIZE, total - loadedThrough)));
    setError(null);
  }, [conversationId]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    if (!conversationId) {
      setMessages([]);
      setHasMore(false);
      setError(null);
      return;
    }

    pageRef.current = 0;
    setLoading(true);
    setError(null);
    void loadPage(0, false, generation)
      .catch((e) => {
        if (generation !== generationRef.current) return;
        setError(e instanceof Error ? e.message : 'Не удалось загрузить сообщения');
        setMessages([]);
      })
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  }, [conversationId, loadPage]);

  const loadMore = useCallback(() => {
    if (!conversationId || loadingMore || !hasMore || loading) return;
    const generation = generationRef.current;
    const next = pageRef.current + 1;
    pageRef.current = next;
    setLoadingMore(true);
    void loadPage(next, true, generation)
      .catch((e) => {
        if (generation !== generationRef.current) return;
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (generation === generationRef.current) setLoadingMore(false);
      });
  }, [conversationId, hasMore, loading, loadingMore, loadPage]);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    pageRef.current = 0;
    setLoading(true);
    void loadPage(0, false, generation)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  }, [conversationId, loadPage]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  return { messages, loading, loadingMore, hasMore, remainingMore, error, loadMore, refresh, removeMessage };
}
