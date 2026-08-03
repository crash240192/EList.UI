// entities/user/walletApi.ts

import { apiClient } from '@/shared/api/client';

export interface IWallet {
  id: string;
  accountId?: string | null;
  organizationId?: string | null;
  tariffId: string | null;
  balance: number;
  createdAt?: string;
  paidDate?: string | null;
  lastChargeDate?: string | null;
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
 * GET /api/Wallets/byOrganization/{organizationId}
 * Кошелёк организации (с tariffId текущего тарифа).
 */
export async function getWalletByOrganization(organizationId: string): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<IWallet>(`/api/Wallets/byOrganization/${organizationId}`);
    return r.result ?? null;
  } catch { return null; }
}

/**
 * POST /api/Wallets/byOrganization/create
 * Создаёт кошелёк для организации. В теле передаём organizationId
 * (поле может отсутствовать в урезанной swagger-модели Wallet).
 */
export async function createOrganizationWallet(organizationId: string): Promise<string | null> {
  const r = await apiClient.post<string | null>('/api/Wallets/byOrganization/create', {
    organizationId,
  });
  return r.result ?? null;
}

/** Получить или создать кошелёк организации */
export async function ensureOrganizationWallet(organizationId: string): Promise<IWallet> {
  const existing = await getWalletByOrganization(organizationId);
  if (existing?.id) return existing;

  await createOrganizationWallet(organizationId);
  const created = await getWalletByOrganization(organizationId);
  if (!created?.id) {
    throw new Error('Не удалось создать кошелёк организации');
  }
  return created;
}

/**
 * PUT /api/Wallets/setTariff?walletId=...&tariffId=...
 * query-параметры
 */
export async function setWalletTariff(walletId: string, tariffId: string): Promise<void> {
  await apiClient.put(`/api/Wallets/setTariff?walletId=${walletId}&tariffId=${tariffId}`, {});
}
