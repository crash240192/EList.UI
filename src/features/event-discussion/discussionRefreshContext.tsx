import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface DiscussionRefreshContextValue {
  bump: (messageId: string) => void;
  getBump: (messageId: string) => number;
}

const DiscussionRefreshContext = createContext<DiscussionRefreshContextValue | null>(null);

export function DiscussionRefreshProvider({ children }: { children: React.ReactNode }) {
  const [bumps, setBumps] = useState<Record<string, number>>({});

  const bump = useCallback((messageId: string) => {
    setBumps((prev) => ({ ...prev, [messageId]: (prev[messageId] ?? 0) + 1 }));
  }, []);

  const getBump = useCallback((messageId: string) => bumps[messageId] ?? 0, [bumps]);

  const value = useMemo(() => ({ bump, getBump }), [bump, getBump]);

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
