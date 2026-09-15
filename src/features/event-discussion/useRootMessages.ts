import { useState, useEffect, useCallback, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { fetchConversationRootMessages } from '@/entities/conversation';
import {
  DISCUSSION_ROOT_PAGE_SIZE,
  discussionTotalPages,
} from './discussionViewMode';

export function useRootMessages(
  conversationId: string | null,
  options?: { initialPageIndex?: number },
) {
  const initialPageIndex = options?.initialPageIndex ?? 0;
  const initialPageRef = useRef(initialPageIndex);
  initialPageRef.current = initialPageIndex;
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const totalPages = discussionTotalPages(total, DISCUSSION_ROOT_PAGE_SIZE);

  const loadPage = useCallback(async (nextPage: number, generation: number, replaceLoading: boolean) => {
    if (!conversationId) return;
    if (replaceLoading) setLoading(true);
    else setPageLoading(true);

    try {
      const paged = await fetchConversationRootMessages(
        conversationId,
        nextPage,
        DISCUSSION_ROOT_PAGE_SIZE,
      );
      if (generation !== generationRef.current) return;

      const nextTotal = paged.total ?? 0;
      const maxPage = Math.max(0, discussionTotalPages(nextTotal, DISCUSSION_ROOT_PAGE_SIZE) - 1);
      const safePage = Math.min(nextPage, maxPage);

      // Если запросили страницу за пределами — подтянем последнюю
      if (safePage !== nextPage && nextTotal > 0) {
        const last = await fetchConversationRootMessages(
          conversationId,
          safePage,
          DISCUSSION_ROOT_PAGE_SIZE,
        );
        if (generation !== generationRef.current) return;
        setMessages(last.result ?? []);
        setTotal(last.total ?? 0);
        setPageIndex(safePage);
      } else {
        setMessages(paged.result ?? []);
        setTotal(nextTotal);
        setPageIndex(safePage);
      }
      setError(null);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(e instanceof Error ? e.message : 'Не удалось загрузить сообщения');
      if (replaceLoading) setMessages([]);
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setPageLoading(false);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;

    if (!conversationId) {
      setMessages([]);
      setTotal(0);
      setPageIndex(0);
      setError(null);
      return;
    }

    const startPage = Math.max(0, initialPageRef.current);
    setPageIndex(startPage);
    void loadPage(startPage, generation, true);
  }, [conversationId, loadPage]);

  const goToPage = useCallback((nextPage: number) => {
    if (!conversationId || loading || pageLoading) return;
    const generation = generationRef.current;
    void loadPage(nextPage, generation, false);
  }, [conversationId, loadPage, loading, pageLoading]);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    void loadPage(pageIndex, generation, true);
  }, [conversationId, loadPage, pageIndex]);

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
    pageLoading,
    pageIndex,
    totalPages,
    total,
    error,
    goToPage,
    refresh,
    removeMessage,
  };
}
