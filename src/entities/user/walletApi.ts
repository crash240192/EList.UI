// entities/user/walletApi.ts

import { apiClient } from '@/shared/api/client';

export interface IWallet {
  id: string;
  accountId?: string | null;
  organizationId?: string | null;
  /** Текущий тариф entitlement (PeriodPurchase: без лимбо). */
  tariffId: string | null;
  balance: number;
  createdAt?: string;
  paidDate?: string | null;
  lastChargeDate?: string | null;
  /** Legacy next charge / PeriodPurchase activeUntil. */
  nextChargeAt?: string | null;
  /** Синоним nextChargeAt в PeriodPurchase. */
  activeUntil?: string | null;
  effectiveTariffId?: string | null;
  isSelectedTariffActive?: boolean;
  tariffBillingStatus?: string | null;
  /** PeriodPurchase | WalletAutoRenew */
  billingMode?: string | null;
}

export type WalletDepositStatus = 'Pending' | 'Succeeded' | 'Canceled' | 'Failed';

export type WalletTariffPurchaseKind = 'TopUp' | 'Purchase' | 'Extend' | 'Upgrade' | number;

export interface IWalletDeposit {
  id: string;
  walletId: string;
  amount: number;
  currency: string;
  status: WalletDepositStatus;
  providerPaymentId: string | null;
  createDate: string;
  paidAt: string | null;
  balanceAfter?: number | null;
  tariffId?: string | null;
  purchaseKind?: WalletTariffPurchaseKind;
  creditApplied?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
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

export interface ITariffPurchaseQuote {
  walletId: string;
  tariffId: string;
  tariffName: string;
  kind: string;
  listPrice: number;
  credit: number;
  amountDue: number;
  periodDays: number;
  currentActiveUntil: string | null;
  newActiveUntil: string;
  message: string | null;
}

export interface ICreateTariffPurchaseResponse {
  deposit: IWalletDeposit;
  confirmationUrl: string | null;
  providerPaymentId: string | null;
  paidImmediately: boolean;
  wallet?: IWallet | null;
}

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nullableStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function normalizePurchaseKind(raw: unknown): WalletTariffPurchaseKind {
  if (typeof raw === 'number') return raw;
  const s = asStr(raw);
  if (!s) return 'TopUp';
  return s as WalletTariffPurchaseKind;
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
    tariffId: nullableStr(raw.tariffId ?? raw.TariffId),
    purchaseKind: normalizePurchaseKind(raw.purchaseKind ?? raw.PurchaseKind),
    creditApplied: asNum(raw.creditApplied ?? raw.CreditApplied),
    periodStart: nullableStr(raw.periodStart ?? raw.PeriodStart),
    periodEnd: nullableStr(raw.periodEnd ?? raw.PeriodEnd),
  };
}

function normalizeWallet(raw: Record<string, unknown> | null | undefined): IWallet | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = asStr(raw.id ?? raw.Id);
  if (!id) return null;
  const next = nullableStr(raw.nextChargeAt ?? raw.NextChargeAt);
  const active = nullableStr(raw.activeUntil ?? raw.ActiveUntil) ?? next;
  return {
    id,
    accountId: nullableStr(raw.accountId ?? raw.AccountId),
    organizationId: nullableStr(raw.organizationId ?? raw.OrganizationId),
    tariffId: nullableStr(raw.tariffId ?? raw.TariffId),
    balance: asNum(raw.balance ?? raw.Balance),
    createdAt: nullableStr(raw.createdAt ?? raw.CreatedAt) ?? undefined,
    paidDate: nullableStr(raw.paidDate ?? raw.PaidDate),
    lastChargeDate: nullableStr(raw.lastChargeDate ?? raw.LastChargeDate),
    nextChargeAt: next,
    activeUntil: active,
    effectiveTariffId: nullableStr(raw.effectiveTariffId ?? raw.EffectiveTariffId),
    isSelectedTariffActive: Boolean(raw.isSelectedTariffActive ?? raw.IsSelectedTariffActive),
    tariffBillingStatus: nullableStr(raw.tariffBillingStatus ?? raw.TariffBillingStatus),
    billingMode: nullableStr(raw.billingMode ?? raw.BillingMode),
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

function normalizeQuote(raw: Record<string, unknown>): ITariffPurchaseQuote {
  return {
    walletId: asStr(raw.walletId ?? raw.WalletId),
    tariffId: asStr(raw.tariffId ?? raw.TariffId),
    tariffName: asStr(raw.tariffName ?? raw.TariffName),
    kind: asStr(raw.kind ?? raw.Kind) || 'Purchase',
    listPrice: asNum(raw.listPrice ?? raw.ListPrice),
    credit: asNum(raw.credit ?? raw.Credit),
    amountDue: asNum(raw.amountDue ?? raw.AmountDue),
    periodDays: asNum(raw.periodDays ?? raw.PeriodDays) || 30,
    currentActiveUntil: nullableStr(raw.currentActiveUntil ?? raw.CurrentActiveUntil),
    newActiveUntil: asStr(raw.newActiveUntil ?? raw.NewActiveUntil),
    message: nullableStr(raw.message ?? raw.Message),
  };
}

/** GET /api/Wallets/create */
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

/** GET /api/Wallets/byOrganization/{organizationId} */
export async function getWalletByOrganization(organizationId: string): Promise<IWallet | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(`/api/Wallets/byOrganization/${organizationId}`);
    return normalizeWallet((r.result ?? null) as Record<string, unknown> | null);
  } catch { return null; }
}

/** POST /api/Wallets/byOrganization/create */
export async function createOrganizationWallet(organizationId: string): Promise<string | null> {
  const r = await apiClient.post<string | null>('/api/Wallets/byOrganization/create', {
    organizationId,
  });
  return r.result ?? null;
}

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

/** PUT /api/Wallets/setTariff — только free в PeriodPurchase */
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

/** POST /api/Wallets/tariffPurchases/quote */
export async function quoteTariffPurchase(payload: {
  walletId: string;
  tariffId: string;
}): Promise<ITariffPurchaseQuote> {
  const r = await apiClient.post<Record<string, unknown>>('/api/Wallets/tariffPurchases/quote', payload);
  return normalizeQuote((r.result ?? {}) as Record<string, unknown>);
}

/** POST /api/Wallets/tariffPurchases */
export async function createTariffPurchase(payload: {
  walletId: string;
  tariffId: string;
  returnUrl?: string;
  idempotencyKey?: string;
}): Promise<ICreateTariffPurchaseResponse> {
  const r = await apiClient.post<Record<string, unknown>>('/api/Wallets/tariffPurchases', {
    walletId: payload.walletId,
    tariffId: payload.tariffId,
    returnUrl: payload.returnUrl,
    idempotencyKey: payload.idempotencyKey ?? newIdempotencyKey(),
  });
  const raw = (r.result ?? {}) as Record<string, unknown>;
  const depositRaw = (raw.deposit ?? raw.Deposit ?? {}) as Record<string, unknown>;
  const walletRaw = (raw.wallet ?? raw.Wallet) as Record<string, unknown> | null | undefined;
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
    wallet: walletRaw ? normalizeWallet(walletRaw) : null,
  };
}

/** @deprecated PeriodPurchase: используйте createTariffPurchase */
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

export async function completeWalletDeposit(payload: {
  depositId?: string;
  providerPaymentId?: string;
}): Promise<IWalletDeposit> {
  const r = await apiClient.post<Record<string, unknown>>('/api/Wallets/deposits/complete', payload);
  return normalizeDeposit((r.result ?? {}) as Record<string, unknown>);
}

export async function fetchWalletDeposits(walletId: string): Promise<IWalletDeposit[]> {
  const r = await apiClient.get<Record<string, unknown>[]>(`/api/Wallets/${walletId}/deposits`);
  return (r.result ?? []).map(row => normalizeDeposit(row as Record<string, unknown>));
}

export async function fetchWalletDeposit(params: {
  walletId?: string;
  depositId?: string;
  providerPaymentId?: string;
}): Promise<IWalletDeposit | null> {
  if (params.depositId) {
    try {
      const byId = await fetchWalletDepositById(params.depositId);
      if (byId) return byId;
    } catch {
      // fallback
    }
  }

  if (!params.walletId) return null;

  const list = await fetchWalletDeposits(params.walletId);
  if (params.depositId) {
    const byId = list.find(d => d.id === params.depositId);
    if (byId) return byId;
  }
  if (params.providerPaymentId) {
    const payId = params.providerPaymentId.trim();
    return list.find(d => d.providerPaymentId === payId) ?? null;
  }
  return null;
}

export async function fetchWalletDepositById(depositId: string): Promise<IWalletDeposit | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(
      `/api/Wallets/deposits/${encodeURIComponent(depositId)}`,
    );
    return r.result ? normalizeDeposit(r.result as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function fetchWalletTariffCharges(walletId: string): Promise<IWalletTariffCharge[]> {
  const r = await apiClient.get<Record<string, unknown>[]>(`/api/Wallets/${walletId}/tariffCharges`);
  return (r.result ?? []).map(row => normalizeTariffCharge(row as Record<string, unknown>));
}

export function purchaseKindLabel(kind: WalletTariffPurchaseKind | undefined): string {
  const k = kind;
  if (k === 'Purchase' || k === 1) return 'Покупка тарифа';
  if (k === 'Extend' || k === 2) return 'Продление тарифа';
  if (k === 'Upgrade' || k === 3) return 'Upgrade тарифа';
  if (k === 'TopUp' || k === 0) return 'Пополнение баланса';
  return 'Платёж тарифа';
}

export function walletActiveUntil(wallet: IWallet | null | undefined): string | null {
  if (!wallet) return null;
  return wallet.activeUntil || wallet.nextChargeAt || null;
}

export function isPeriodPurchaseMode(wallet: IWallet | null | undefined): boolean {
  const mode = wallet?.billingMode?.trim();
  if (!mode) return true; // API default PeriodPurchase
  return mode.toLowerCase() === 'periodpurchase';
}
