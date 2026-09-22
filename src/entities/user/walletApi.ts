// entities/user/walletApi.ts

import { apiClient } from '@/shared/api/client';

export interface IWallet {
  id: string;
  accountId?: string | null;
  organizationId?: string | null;
  /** Выбранный тариф (сохраняется даже если период не оплачен). */
  tariffId: string | null;
  balance: number;
  createdAt?: string;
  paidDate?: string | null;
  lastChargeDate?: string | null;
  /** Следующее списание тарифа; null = выбранный платный не активен / ждёт средств */
  nextChargeAt?: string | null;
  /** Тариф, чьи лимиты сейчас действуют (выбранный или free default). */
  effectiveTariffId?: string | null;
  /** Выбранный тариф сейчас активен (оплаченный период или cost=0). */
  isSelectedTariffActive?: boolean;
  /** Статус биллинга с бэка. */
  tariffBillingStatus?: string | null;
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
  /** Баланс сразу после зачисления (до возможного автосписания тарифа). */
  balanceAfter?: number | null;
}

export interface IWalletTariffCharge {
  id: string;
  walletId: string;
  tariffId: string;
  amount: number;
  currency: string;
  chargedAt: string;
  nextChargeAt: string;
  balanceAfter: number;
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
    balanceAfter: (() => {
      const v = raw.balanceAfter ?? raw.BalanceAfter;
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

function nullableStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function normalizeWallet(raw: Record<string, unknown> | null | undefined): IWallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = asStr(raw.id ?? raw.Id);
  if (!id) return null;
  return {
    id,
    accountId: nullableStr(raw.accountId ?? raw.AccountId),
    organizationId: nullableStr(raw.organizationId ?? raw.OrganizationId),
    tariffId: nullableStr(raw.tariffId ?? raw.TariffId),
    balance: asNum(raw.balance ?? raw.Balance),
    createdAt: nullableStr(raw.createdAt ?? raw.CreatedAt) ?? undefined,
    paidDate: nullableStr(raw.paidDate ?? raw.PaidDate),
    lastChargeDate: nullableStr(raw.lastChargeDate ?? raw.LastChargeDate),
    nextChargeAt: nullableStr(raw.nextChargeAt ?? raw.NextChargeAt),
    effectiveTariffId: nullableStr(raw.effectiveTariffId ?? raw.EffectiveTariffId),
    isSelectedTariffActive: Boolean(raw.isSelectedTariffActive ?? raw.IsSelectedTariffActive),
    tariffBillingStatus: nullableStr(raw.tariffBillingStatus ?? raw.TariffBillingStatus),
  };
}

function normalizeTariffCharge(raw: Record<string, unknown>): IWalletTariffCharge {
  return {
    id: asStr(raw.id ?? raw.Id),
    walletId: asStr(raw.walletId ?? raw.WalletId),
    tariffId: asStr(raw.tariffId ?? raw.TariffId),
    amount: asNum(raw.amount ?? raw.Amount),
    currency: asStr(raw.currency ?? raw.Currency) || 'RUB',
    chargedAt: asStr(raw.chargedAt ?? raw.ChargedAt),
    nextChargeAt: asStr(raw.nextChargeAt ?? raw.NextChargeAt),
    balanceAfter: asNum(raw.balanceAfter ?? raw.BalanceAfter),
  };
}

/** GET /api/Wallets/create — создать кошелёк (без тела) */
export async function createWallet(): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>('/api/Wallets/create');
    return normalizeWallet((r.result ?? null) as Record<string, unknown> | null);
  } catch { return null; }
}

/** GET /api/Wallets/byAccount/{accountId} */
export async function getWalletByAccount(accountId: string): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(`/api/Wallets/byAccount/${accountId}`);
    return normalizeWallet((r.result ?? null) as Record<string, unknown> | null);
  } catch { return null; }
}

/**
 * GET /api/Wallets/byOrganization/{organizationId}
 * Кошелёк организации (с tariffId текущего тарифа).
 */
export async function getWalletByOrganization(organizationId: string): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(`/api/Wallets/byOrganization/${organizationId}`);
    return normalizeWallet((r.result ?? null) as Record<string, unknown> | null);
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
/** PUT /api/Wallets/setTariff?walletId=...&tariffId=... */
export async function setWalletTariff(walletId: string, tariffId: string): Promise<string | null> {
  const r = await apiClient.put<unknown>(`/api/Wallets/setTariff?walletId=${walletId}&tariffId=${tariffId}`, {});
  const msg = (r as { message?: string | null }).message;
  return msg == null || msg === '' ? null : String(msg);
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

/** GET /api/Wallets/{walletId}/tariffCharges — ledger списаний тарифа */
export async function fetchWalletTariffCharges(walletId: string): Promise<IWalletTariffCharge[]> {
  const r = await apiClient.get<Record<string, unknown>[]>(`/api/Wallets/${walletId}/tariffCharges`);
  return (r.result ?? []).map(row => normalizeTariffCharge(row as Record<string, unknown>));
}
