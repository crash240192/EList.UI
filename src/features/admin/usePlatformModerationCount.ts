import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchPlatformContentReportsCount } from '@/entities/contentReport';

interface PlatformModerationCountState {
  count: number;
  setCount: (count: number) => void;
  refresh: () => Promise<void>;
}

export const usePlatformModerationCountStore = create<PlatformModerationCountState>((set) => ({
  count: 0,
  setCount: count => set({ count }),
  refresh: async () => {
    try {
      const count = await fetchPlatformContentReportsCount(true);
      set({ count });
    } catch {
      set({ count: 0 });
    }
  },
}));

export function usePlatformModerationCount(enabled: boolean): number {
  const count = usePlatformModerationCountStore(s => s.count);
  const refresh = usePlatformModerationCountStore(s => s.refresh);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return enabled ? count : 0;
}
