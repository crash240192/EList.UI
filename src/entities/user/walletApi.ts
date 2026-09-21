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

export type WalletDepositStatus = 'Pending' | 'Succeeded' | 'Canceled' | 'Failed';

export interface IWalletDeposit {
  id: string;
  walletId: string;
  amount: number;
  currency: string;
  status: WalletDepositStatus;
  providerPaymentId: string | null;
  createDate: string;
  paidAt: string | null;
}

export interface ICreateWalletDepositResponse {
  deposit: IWalletDeposit;
  confirmationUrl: string | null;
  providerPaymentId: string | null;
  paidImmediately: boolean;
}

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDeposit(raw: Record<string, unknown>): IWalletDeposit {
  return {
    id: asStr(raw.id ?? raw.Id),
    walletId: asStr(raw.walletId ?? raw.WalletId),
    amount: asNum(raw.amount ?? raw.Amount),
    currency: asStr(raw.currency ?? raw.Currency) || 'RUB',
    status: asStr(raw.status ?? raw.Status) as WalletDepositStatus,
    providerPaymentId: (() => {
      const v = raw.providerPaymentId ?? raw.ProviderPaymentId;
      return v == null || v === '' ? null : String(v);
    })(),
    createDate: asStr(raw.createDate ?? raw.CreateDate),
    paidAt: raw.paidAt != null || raw.PaidAt != null
      ? asStr(raw.paidAt ?? raw.PaidAt)
      : null,
  };
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

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `wd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** POST /api/Wallets/deposits — пополнение тарифного кошелька (stub/ЮKassa) */
export async function createWalletDeposit(payload: {
  walletId: string;
  amount: number;
  currency?: string;
  returnUrl?: string;
  idempotencyKey?: string;
}): Promise<ICreateWalletDepositResponse> {
  const r = await apiClient.post<Record<string, unknown>>('/api/Wallets/deposits', {
    walletId: payload.walletId,
    amount: payload.amount,
    currency: payload.currency ?? 'RUB',
    returnUrl: payload.returnUrl,
    idempotencyKey: payload.idempotencyKey ?? newIdempotencyKey(),
  });
  const raw = (r.result ?? {}) as Record<string, unknown>;
  const depositRaw = (raw.deposit ?? raw.Deposit ?? {}) as Record<string, unknown>;
  return {
    deposit: normalizeDeposit(depositRaw),
    confirmationUrl: (() => {
      const v = raw.confirmationUrl ?? raw.ConfirmationUrl;
      return v == null || v === '' ? null : String(v);
    })(),
    providerPaymentId: (() => {
      const v = raw.providerPaymentId ?? raw.ProviderPaymentId;
      return v == null || v === '' ? null : String(v);
    })(),
    paidImmediately: Boolean(raw.paidImmediately ?? raw.PaidImmediately),
  };
}

/** POST /api/Wallets/deposits/complete — stub подтверждение пополнения */
export async function completeWalletDeposit(payload: {
  depositId?: string;
  providerPaymentId?: string;
}): Promise<IWalletDeposit> {
  const r = await apiClient.post<Record<string, unknown>>('/api/Wallets/deposits/complete', payload);
  return normalizeDeposit((r.result ?? {}) as Record<string, unknown>);
}

/** GET /api/Wallets/{walletId}/deposits */
export async function fetchWalletDeposits(walletId: string): Promise<IWalletDeposit[]> {
  const r = await apiClient.get<Record<string, unknown>[]>(`/api/Wallets/${walletId}/deposits`);
  return (r.result ?? []).map(row => normalizeDeposit(row as Record<string, unknown>));
}
