// entities/user/walletApi.ts

import { apiClient } from '@/shared/api/client';

export interface IWallet {
  id: string;
  accountId: string;
  tariffId: string | null;
  balance: number;
  createdAt?: string;
}

/** GET /api/Wallets/create — создать кошелёк (без тела) */
export async function createWallet(): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<IWallet>('/api/Wallets/create');
    return r.result ?? null;
  } catch { return null; }
}

/** GET /api/Wallets/byAccount/{accountId} */
export async function getWalletByAccount(accountId: string): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<IWallet>(`/api/Wallets/byAccount/${accountId}`);
    return r.result ?? null;
  } catch { return null; }
}

/**
 * PUT /api/Wallets/setTariff?walletId=...&tariffId=...
 * query-параметры
 */
export async function setWalletTariff(walletId: string, tariffId: string): Promise<void> {
  await apiClient.put(`/api/Wallets/setTariff?walletId=${walletId}&tariffId=${tariffId}`, {});
}
