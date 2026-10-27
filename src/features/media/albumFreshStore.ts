import { useEffect } from 'react';
import { create } from 'zustand';
import { accountHasUnseenAlbums } from '@/entities/media/albumApi';
import { getStoredAccountId } from '@/entities/user/api';
import { useAccountId } from '@/features/auth/useAccountId';

interface AlbumFreshState {
  hasFresh: boolean;
  refresh: (accountId: string) => Promise<void>;
  reset: () => void;
}

let refreshGeneration = 0;

export const useAlbumFreshStore = create<AlbumFreshState>((set) => ({
  hasFresh: false,

  refresh: async (accountId: string) => {
    const generation = ++refreshGeneration;
    try {
      const hasFresh = await accountHasUnseenAlbums(accountId);
      if (generation === refreshGeneration) set({ hasFresh });
    } catch {
      /* оставляем предыдущее значение */
    }
  },

  reset: () => {
    refreshGeneration += 1;
    set({ hasFresh: false });
  },
}));

/** Перечитать индикатор после того, как альбом отметили просмотренным. */
export function syncUnseenAlbums(): void {
  const accountId = getStoredAccountId();
  if (!accountId) return;
  void useAlbumFreshStore.getState().refresh(accountId);
}

/** Кружок в меню, пока у аккаунта есть альбом с непросмотренными фото. */
export function useUnseenAlbumsIndicator(enabled: boolean): void {
  const { accountId } = useAccountId();
  const refresh = useAlbumFreshStore(s => s.refresh);
  const reset = useAlbumFreshStore(s => s.reset);

  useEffect(() => {
    if (!enabled || !accountId) {
      reset();
      return;
    }
    void refresh(accountId);
  }, [enabled, accountId, refresh, reset]);
}
