import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import type { IMessage } from '@/entities/conversation';

type AppendListener = (message: IMessage) => void;

interface DiscussionRefreshContextValue {
  /** Раскрыть ветку / пометить «есть ответы» без полной перезагрузки списка */
  bump: (messageId: string) => void;
  resetBump: (messageId: string) => void;
  getBump: (messageId: string) => number;
  /** Вставить ответ в уже загруженный список детей parentId */
  appendChild: (parentId: string, message: IMessage) => void;
  subscribeAppend: (parentId: string, listener: AppendListener) => () => void;
}

const DiscussionRefreshContext = createContext<DiscussionRefreshContextValue | null>(null);

export function DiscussionRefreshProvider({ children }: { children: React.ReactNode }) {
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const appendListenersRef = useRef(new Map<string, Set<AppendListener>>());

  const bump = useCallback((messageId: string) => {
    setBumps((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? 0) + 1 }));
  }, []);

  const resetBump = useCallback((messageId: string) => {
    setBumps((prev) => {
      if (prev[messageId] == null) return prev;
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  const getBump = useCallback((messageId: string) => bumps[messageId] ?? 0, [bumps]);

  const subscribeAppend = useCallback((parentId: string, listener: AppendListener) => {
    if (!appendListenersRef.current.has(parentId)) {
      appendListenersRef.current.set(parentId, new Set());
    }
    appendListenersRef.current.get(parentId)!.add(listener);
    return () => {
      appendListenersRef.current.get(parentId)?.delete(listener);
    };
  }, []);

  const appendChild = useCallback((parentId: string, message: IMessage) => {
    bump(parentId);
    appendListenersRef.current.get(parentId)?.forEach((fn) => {
      try {
        fn(message);
      } catch {
        /* ignore listener errors */
      }
    });
  }, [bump]);

  const value = useMemo(
    () => ({ bump, resetBump, getBump, appendChild, subscribeAppend }),
    [bump, resetBump, getBump, appendChild, subscribeAppend],
  );

  return (
    <DiscussionRefreshContext.Provider value={value}>{children}</DiscussionRefreshContext.Provider>
  );
}

export function useDiscussionRefresh(messageId: string): number {
  const ctx = useContext(DiscussionRefreshContext);
  return ctx?.getBump(messageId) ?? 0;
}

export function useDiscussionRefreshActions(): DiscussionRefreshContextValue {
  const ctx = useContext(DiscussionRefreshContext);
  if (!ctx) {
    throw new Error('useDiscussionRefreshActions must be used within DiscussionRefreshProvider');
  }
  return ctx;
}

/** Подписка на локальную вставку ответа под parentId (без refetch) */
export function useDiscussionAppend(
  parentId: string,
  onAppend: AppendListener,
): void {
  const { subscribeAppend } = useDiscussionRefreshActions();
  const onAppendRef = useRef(onAppend);
  onAppendRef.current = onAppend;

  useEffect(() => {
    return subscribeAppend(parentId, (message) => {
      onAppendRef.current(message);
    });
  }, [parentId, subscribeAppend]);
}
