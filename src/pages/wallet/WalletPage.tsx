// pages/wallet/WalletPage.tsx — страница «Тариф» (PeriodPurchase)

import { useState, useEffect, useCallback } from 'react';
import {
  createWallet,
  getWalletByAccount,
  createTariffPurchase,
  fetchWalletDeposits,
  fetchWalletTariffCharges,
  purchaseKindLabel,
  walletActiveUntil,
  isPeriodPurchaseMode,
  type IWallet,
  type IWalletDeposit,
  type IWalletTariffCharge,
} from '@/entities/user/walletApi';
import { tariffApi, tariffValidatorApi, type ITariff, type ITariffValidator } from '@/entities/admin/adminApi';
import {
  fetchMyOrders,
  formatMoney,
  ORDER_STATUS_LABELS,
  type IOrder,
} from '@/entities/order';
import { fetchEventById } from '@/entities/event';
import { getOrFetchAccountId } from '@/entities/user/api';
import { TariffPlansPicker } from '@/features/wallet';
import { usePageTitle } from '@/shared/hooks';
import styles from './WalletPage.module.css';

type HistoryKind = 'in' | 'out' | 'tariff';

interface HistoryRow {
  id: string;
  kind: HistoryKind;
  name: string;
  meta: string;
  amount: string;
  sortAt: number;
}

const HIST_ICO_CLASS = {
  in: styles.histIcoIn,
  out: styles.histIcoOut,
  tariff: styles.histIcoTariff,
} as const;

const HIST_AMT_CLASS = {
  in: styles.histAmtIn,
  out: styles.histAmtOut,
  tariff: styles.histAmtTariff,
} as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysLeft(iso: string): number | null {
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function WalletPage() {
  usePageTitle('Тариф');
  const [wallet, setWallet] = useState<IWallet | null>(null);
  const [tariff, setTariff] = useState<ITariff | null>(null);
  const [allTariffs, setAllTariffs] = useState<ITariff[]>([]);
  const [validators, setValidators] = useState<Record<string, ITariffValidator | null>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [ticketsEnabled, setTicketsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('@/shared/api/featuresApi')
      .then(m => m.fetchAppFeatures())
      .then(f => {
        if (!cancelled) setTicketsEnabled(f.ticketsEnabled);
      })
      .catch(() => {
        if (!cancelled) setTicketsEnabled(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadHistory = useCallback(async (
    currentTariff: ITariff | null,
    currentWallet: IWallet | null,
    tariffsCatalog: ITariff[] = [],
    includeTicketOrders = false,
  ) => {
    setHistoryLoading(true);
    try {
      const rows: HistoryRow[] = [];
      const tariffNameById = new Map<string, string>();
      for (const t of tariffsCatalog) {
        if (t.id) tariffNameById.set(t.id, t.name);
      }
      if (currentTariff?.id) tariffNameById.set(currentTariff.id, currentTariff.name);

      if (currentWallet?.id) {
        const [deposits, charges] = await Promise.all([
          fetchWalletDeposits(currentWallet.id).catch(() => [] as IWalletDeposit[]),
          fetchWalletTariffCharges(currentWallet.id).catch(() => [] as IWalletTariffCharge[]),
        ]);

        for (const d of deposits.filter(x => x.status === 'Succeeded')) {
          const when = d.paidAt || d.createDate;
          const sortAt = when ? new Date(when).getTime() : 0;
          const dateLabel = when ? formatDateTime(when) : '';
          const planName = d.tariffId ? tariffNameById.get(d.tariffId) : null;
          const kindLabel = purchaseKindLabel(d.purchaseKind);
          const name = planName ? `${kindLabel} «${planName}»` : kindLabel;
          rows.push({
            id: `deposit-${d.id}`,
            kind: 'tariff',
            name,
            meta: [dateLabel, d.periodEnd ? `до ${formatDateShort(d.periodEnd)}` : null]
              .filter(Boolean)
              .join(' · '),
            amount: d.amount > 0
              ? `− ${d.amount.toLocaleString('ru-RU')} ₽`
              : '0 ₽',
            sortAt: Number.isFinite(sortAt) ? sortAt : 0,
          });
        }

        // Legacy charges only if no purchase-kind deposits cover the story
        const hasPurchaseDeposits = deposits.some(
          d => d.status === 'Succeeded' && d.purchaseKind != null && d.purchaseKind !== 'TopUp' && d.purchaseKind !== 0,
        );
        if (!hasPurchaseDeposits) {
          for (const c of charges) {
            const sortAt = c.chargedAt ? new Date(c.chargedAt).getTime() : 0;
            const dateLabel = c.chargedAt ? formatDateTime(c.chargedAt) : '';
            const name = tariffNameById.get(c.tariffId)
              ? `Тариф «${tariffNameById.get(c.tariffId)}»`
              : 'Списание тарифа';
            rows.push({
              id: `charge-${c.id}`,
              kind: 'tariff',
              name,
              meta: [dateLabel, 'Списание'].filter(Boolean).join(' · '),
              amount: c.amount > 0
                ? `− ${Number(c.amount).toLocaleString('ru-RU')} ₽`
                : '0 ₽',
              sortAt: Number.isFinite(sortAt) ? sortAt : 0,
            });
          }
        }
      }

      if (includeTicketOrders) {
        const orders = await fetchMyOrders().catch(() => [] as IOrder[]);
        const eventIds = [...new Set(orders.map(o => o.eventId).filter(Boolean))];
        const nameById = new Map<string, string>();
        await Promise.all(eventIds.map(async (eventId) => {
          try {
            const ev = await fetchEventById(eventId);
            if (ev?.name) nameById.set(eventId, ev.name);
          } catch { /* ignore */ }
        }));

        for (const order of orders) {
          const when = order.paidAt || order.createDate;
          const sortAt = when ? new Date(when).getTime() : 0;
          const dateLabel = when ? formatDateTime(when) : '';
          const status = ORDER_STATUS_LABELS[order.status] ?? order.status;
          const qty = order.quantity > 1 ? ` · ${order.quantity} билета` : ' · Билет';
          const isRefund = order.status === 'Refunded' || order.status === 'PartiallyRefunded';
          const amountAbs = formatMoney(order.amountTotal, order.currency);
          rows.push({
            id: `order-${order.id}`,
            kind: isRefund ? 'in' : 'out',
            name: nameById.get(order.eventId) || 'Билет на мероприятие',
            meta: `${dateLabel}${qty} · ${status}`,
            amount: isRefund ? `+ ${amountAbs}` : `− ${amountAbs}`,
            sortAt: Number.isFinite(sortAt) ? sortAt : 0,
          });
        }
      }

      rows.sort((a, b) => b.sortAt - a.sortAt);
      setHistory(rows);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const accountId = await getOrFetchAccountId();
      let w = await getWalletByAccount(accountId);
      if (!w) w = await createWallet();
      setWallet(w);

      const [tariffs, features] = await Promise.all([
        tariffApi.getAll(false).catch(() => []),
        import('@/shared/api/featuresApi').then(m => m.fetchAppFeatures()).catch(() => null),
      ]);
      const ticketsOn = Boolean(features?.ticketsEnabled);
      setTicketsEnabled(ticketsOn);
      setAllTariffs([...tariffs].sort((a, b) => a.cost - b.cost));

      if (w?.tariffId) {
        const t = tariffs.find(x => x.id === w!.tariffId) ?? null;
        setTariff(t);
        await loadHistory(t, w, tariffs, ticketsOn);
      } else {
        setTariff(null);
        await loadHistory(null, w, tariffs, ticketsOn);
      }

      const validatorEntries = await Promise.all(
        tariffs
          .filter(t => t.validatorId)
          .map(async t => {
            const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
            return [t.id, v] as const;
          }),
      );
      setValidators(Object.fromEntries(validatorEntries));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const redirectToPayment = (confirmationUrl: string) => {
    window.location.assign(
      confirmationUrl.startsWith('http')
        ? confirmationUrl
        : `${window.location.origin}${confirmationUrl.startsWith('/') ? '' : '/'}${confirmationUrl}`,
    );
  };

  const handlePeriodPurchase = async (tariffId: string) => {
    if (!wallet || purchasingId) return;
    setPurchasingId(tariffId);
    setMsg(null);
    try {
      const returnUrl = `${window.location.origin}/payments/return`;
      const result = await createTariffPurchase({
        walletId: wallet.id,
        tariffId,
        returnUrl,
      });

      try {
        sessionStorage.setItem('elist_pending_wallet_deposit', JSON.stringify({
          depositId: result.deposit.id,
          walletId: wallet.id,
          providerPaymentId: result.providerPaymentId,
          purpose: 'tariff',
        }));
      } catch { /* ignore */ }

      if (result.paidImmediately) {
        setMsg({ text: 'Тариф активирован', ok: true });
        await load();
        return;
      }

      const confirmationUrl = result.confirmationUrl?.trim() || null;
      if (confirmationUrl) {
        redirectToPayment(confirmationUrl);
        return;
      }

      setMsg({ text: 'Платёж создан, ожидание подтверждения', ok: true });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось оформить тариф', ok: false });
    } finally {
      setPurchasingId(null);
    }
  };

  const handleExtendCurrent = () => {
    if (!tariff?.id) return;
    void handlePeriodPurchase(tariff.id);
  };

  const activeUntil = walletActiveUntil(wallet);
  const left = activeUntil ? daysLeft(activeUntil) : null;
  const paidActive = Boolean(
    tariff && tariff.cost > 0 && wallet?.isSelectedTariffActive && activeUntil,
  );
  const periodMode = isPeriodPurchaseMode(wallet);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.planHero} ${styles.planHeroStub}`}>
              <div className={styles.loader}>Загрузка...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {wallet && (
          <div className={styles.cardHead}>
            <div className={styles.planHero}>
              <div className={styles.planHeroTop}>
                <span className={styles.planHeroEyebrow}>Тариф</span>
                <span className={`${styles.planHeroPill} ${paidActive ? styles.planHeroPillOk : styles.planHeroPillMuted}`}>
                  {paidActive ? 'Активен' : 'Базовый'}
                </span>
              </div>
              <div className={styles.planHeroName}>
                {tariff?.name ?? 'Бесплатный'}
              </div>
              <div className={styles.planHeroMeta}>
                {paidActive && activeUntil
                  ? `до ${formatDateShort(activeUntil)}${left != null ? ` · осталось ${left} дн.` : ''} · без автопродления`
                  : 'Базовые лимиты · платные планы ниже'}
              </div>
              {paidActive && tariff && (
                <div className={styles.planHeroActions}>
                  <button
                    type="button"
                    className={styles.planHeroCta}
                    disabled={Boolean(purchasingId)}
                    onClick={handleExtendCurrent}
                  >
                    {purchasingId === tariff.id
                      ? '…'
                      : `Продлить на ${tariff.periodDays ?? tariff.period?.days ?? 30} дн. · ${tariff.cost.toLocaleString('ru-RU')} ₽`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.walletBody}>
          {msg && (
            <div className={`${styles.msg} ${msg.ok ? styles.msgOk : styles.msgErr}`}>
              {msg.text}
            </div>
          )}

          {wallet && (
            <>
              <div>
                <TariffPlansPicker
                  mode={periodMode ? 'periodPurchase' : 'legacy'}
                  tariffs={allTariffs}
                  validators={validators}
                  walletTariffId={wallet.tariffId}
                  walletEffectiveTariffId={wallet.effectiveTariffId}
                  isSelectedTariffActive={wallet.isSelectedTariffActive}
                  currentTariff={tariff}
                  activeUntil={activeUntil}
                  onPeriodPurchase={(id) => { void handlePeriodPurchase(id); }}
                  purchasingTariffId={purchasingId}
                  title="Планы"
                  subtitle="Покупка на период. Upgrade учитывает остаток текущего."
                />
              </div>

              <div className={styles.historySection}>
                <div className={styles.tariffHeader}>
                  <div>
                    <div className={styles.sectionTitle}>История</div>
                    <div className={styles.sectionSubtitle}>
                      {ticketsEnabled
                        ? 'Платежи тарифа и билеты'
                        : 'Платежи тарифа'}
                    </div>
                  </div>
                </div>
                {historyLoading ? (
                  <div className={styles.historyHint}>Загрузка истории…</div>
                ) : history.length === 0 ? (
                  <p className={styles.historyHint}>Операций пока нет</p>
                ) : (
                  <div className={styles.histList}>
                    {history.map(row => (
                      <div key={row.id} className={styles.histRow}>
                        <div className={`${styles.histIco} ${HIST_ICO_CLASS[row.kind]}`} aria-hidden />
                        <div className={styles.histInfo}>
                          <div className={styles.histName}>{row.name}</div>
                          <div className={styles.histMeta}>{row.meta}</div>
                        </div>
                        <div className={`${styles.histAmt} ${HIST_AMT_CLASS[row.kind]}`}>
                          {row.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
