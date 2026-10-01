// pages/wallet/WalletPage.tsx — макет examples/elist_settings_wallet.html

import { useState, useEffect, useCallback } from 'react';
import { BRAND_NAME } from '@/shared/config/brand';
import {
  createWallet,
  getWalletByAccount,
  setWalletTariff,
  createWalletDeposit,
  completeWalletDeposit,
  fetchWalletDeposits,
  fetchWalletTariffCharges,
  type IWallet,
  type IWalletDeposit,
  type IWalletTariffCharge,
} from '@/entities/user/walletApi';
import { getMyPersonInfo } from '@/entities/user/settingsApi';
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

function formatBalanceAfter(balance: number | null | undefined): string | null {
  if (balance == null || !Number.isFinite(balance)) return null;
  return `остаток ${balance.toLocaleString('ru-RU')} ₽`;
}

/** Статус биллинга: предпочитаем текст с API, иначе локальный fallback. */
function tariffPeriodStatus(wallet: IWallet, tariff: ITariff | null): string | null {
  if (wallet.tariffBillingStatus) return wallet.tariffBillingStatus;
  if (!tariff) return null;
  if (wallet.isSelectedTariffActive || tariff.cost <= 0) {
    const next = wallet.nextChargeAt ? new Date(wallet.nextChargeAt).getTime() : NaN;
    if (Number.isFinite(next) && next > Date.now()) {
      return `Активен до ${formatDateTime(wallet.nextChargeAt!)} · следующее списание`;
    }
    if (tariff.cost <= 0) return 'Бесплатный тариф активен';
  }
  return 'Выбранный тариф не активен — недостаточно средств. Действует бесплатный тариф по умолчанию.';
}

export default function WalletPage() {
  usePageTitle('Кошелёк');
  const [wallet, setWallet] = useState<IWallet | null>(null);
  const [tariff, setTariff] = useState<ITariff | null>(null);
  const [holderName, setHolderName] = useState('');
  const [allTariffs, setAllTariffs] = useState<ITariff[]>([]);
  const [validators, setValidators] = useState<Record<string, ITariffValidator | null>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpBusy, setTopUpBusy] = useState(false);

  const loadHistory = useCallback(async (
    currentTariff: ITariff | null,
    currentWallet: IWallet | null,
    tariffsCatalog: ITariff[] = [],
  ) => {
    setHistoryLoading(true);
    try {
      // Единая лента: депозиты + ledger списаний тарифа + билеты (ЮKassa).
      // Баланс карточки при этом остаётся только тарифным.
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
          const balanceLabel = formatBalanceAfter(d.balanceAfter);
          rows.push({
            id: `deposit-${d.id}`,
            kind: 'in',
            name: 'Пополнение тарифа',
            meta: [dateLabel, 'Тариф платформы', balanceLabel].filter(Boolean).join(' · '),
            amount: `+ ${d.amount.toLocaleString('ru-RU')} ₽`,
            sortAt: Number.isFinite(sortAt) ? sortAt : 0,
          });
        }

        for (const c of charges) {
          const sortAt = c.chargedAt ? new Date(c.chargedAt).getTime() : 0;
          const dateLabel = c.chargedAt ? formatDateTime(c.chargedAt) : '';
          const name = tariffNameById.get(c.tariffId)
            ? `Тариф «${tariffNameById.get(c.tariffId)}»`
            : 'Списание тарифа';
          const balanceLabel = formatBalanceAfter(c.balanceAfter);
          rows.push({
            id: `charge-${c.id}`,
            kind: 'tariff',
            name,
            meta: [dateLabel, 'Списание тарифа', balanceLabel].filter(Boolean).join(' · '),
            amount: c.amount > 0
              ? `− ${Number(c.amount).toLocaleString('ru-RU')} ₽`
              : '0 ₽',
            sortAt: Number.isFinite(sortAt) ? sortAt : 0,
          });
        }
      }

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
          meta: `${dateLabel}${qty} · ${status} · ЮKassa`,
          amount: isRefund ? `+ ${amountAbs}` : `− ${amountAbs}`,
          sortAt: Number.isFinite(sortAt) ? sortAt : 0,
        });
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

      const [tariffs, person] = await Promise.all([
        tariffApi.getAll(false).catch(() => []),
        getMyPersonInfo().catch(() => null),
      ]);
      setAllTariffs([...tariffs].sort((a, b) => a.cost - b.cost));

      if (person) {
        const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
        if (name) setHolderName(name);
      }

      if (w?.tariffId) {
        const t = tariffs.find(x => x.id === w!.tariffId) ?? null;
        setTariff(t);
        await loadHistory(t, w, tariffs);
      } else {
        setTariff(null);
        await loadHistory(null, w, tariffs);
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

  useEffect(() => { load(); }, []);

  const handleSetTariff = async () => {
    if (!wallet || !selectedTariffId) return;
    setSaving(true);
    setMsg(null);
    try {
      const apiMsg = await setWalletTariff(wallet.id, selectedTariffId);
      setMsg({ text: apiMsg || 'Тариф подключён', ok: true });
      setSelectedTariffId('');
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const scrollToTopUp = () => {
    document.getElementById('wallet-top-up')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleTopUp = async () => {
    if (!wallet || topUpBusy) return;
    const amount = Number(String(topUpAmount).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg({ text: 'Укажите сумму больше нуля', ok: false });
      return;
    }
    setTopUpBusy(true);
    setMsg(null);
    try {
      const returnUrl = `${window.location.origin}/payments/return`;
      const result = await createWalletDeposit({
        walletId: wallet.id,
        amount,
        returnUrl,
      });

      const pending = {
        depositId: result.deposit.id,
        providerPaymentId: result.providerPaymentId,
        amount,
      };
      try {
        sessionStorage.setItem('elist_pending_wallet_deposit', JSON.stringify(pending));
      } catch { /* ignore */ }

      if (result.paidImmediately) {
        setTopUpAmount('');
        setMsg({ text: 'Баланс пополнен', ok: true });
        await load();
        return;
      }

      const confirmationUrl = result.confirmationUrl?.trim() || null;
      if (confirmationUrl) {
        let useInAppStub = false;
        try {
          const url = new URL(confirmationUrl, window.location.origin);
          useInAppStub = url.searchParams.get('stub') === '1'
            || url.pathname.includes('/payments/return');
        } catch {
          useInAppStub = false;
        }
        if (!useInAppStub) {
          window.location.assign(confirmationUrl);
          return;
        }
        // Stub: подтверждаем через return-страницу / complete API.
        window.location.assign(confirmationUrl.startsWith('http')
          ? confirmationUrl
          : `${window.location.origin}${confirmationUrl.startsWith('/') ? '' : '/'}${confirmationUrl}`);
        return;
      }

      await completeWalletDeposit({
        depositId: result.deposit.id,
        providerPaymentId: result.providerPaymentId ?? undefined,
      });
      setTopUpAmount('');
      setMsg({ text: 'Баланс пополнен', ok: true });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось создать пополнение', ok: false });
    } finally {
      setTopUpBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={`${styles.bankCard} ${styles.bankCardStub}`}>
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
            <div className={styles.bankCard}>
              <div className={styles.cardTop}>
                <div className={styles.cardBrand}>{BRAND_NAME} Pay</div>
                <div className={styles.cardChip}>
                  <div className={styles.chipLine} />
                  <div className={styles.chipLine} />
                  <div className={styles.chipLine} />
                </div>
              </div>
              <div className={styles.cardMid}>
                <div className={styles.cardLabel}>Баланс</div>
                <div className={styles.cardBalance}>
                  {(wallet.balance ?? 0).toLocaleString('ru-RU')}
                  <span className={styles.cardCurrency}>₽</span>
                </div>
                {tariff && (
                  <div className={styles.cardTariffStatus}>
                    {tariffPeriodStatus(wallet, tariff)}
                  </div>
                )}
              </div>
              <div className={styles.cardBottom}>
                <div>
                  {holderName && (
                    <>
                      <div className={styles.cardHolder}>Владелец</div>
                      <div className={styles.cardHolderName}>{holderName}</div>
                    </>
                  )}
                </div>
                {wallet.id && (
                  <div className={styles.cardId}>ID: {wallet.id.slice(0, 8)}...</div>
                )}
              </div>

              <div className={styles.cardActionsRow}>
                <button type="button" className={styles.cardActionBtn} onClick={scrollToTopUp}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  Пополнить
                </button>
                <button type="button" className={styles.cardActionBtn} disabled title="Недоступно: кошелёк только для тарифа">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                  Вывести
                </button>
                <button type="button" className={styles.cardActionBtn} disabled title="Недоступно">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  Реквизиты
                </button>
              </div>
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
              <div className={styles.topUpSection} id="wallet-top-up">
                <div className={styles.sectionTitle}>Пополнение тарифа</div>
                <div className={styles.topUpStub}>
                  <div className={styles.topUpStubForm}>
                    <label className={styles.topUpLabel}>
                      Сумма пополнения
                      <div className={styles.topUpInputRow}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={styles.topUpInput}
                          placeholder="1 000"
                          value={topUpAmount}
                          onChange={e => setTopUpAmount(e.target.value)}
                          disabled={topUpBusy}
                          autoComplete="off"
                        />
                        <span className={styles.topUpCurrency}>₽</span>
                      </div>
                    </label>
                    <button
                      type="button"
                      className={styles.topUpBtn}
                      disabled={topUpBusy || !topUpAmount.trim()}
                      onClick={() => { void handleTopUp(); }}
                    >
                      {topUpBusy ? '…' : 'Перейти к оплате'}
                    </button>
                  </div>
                  <p className={styles.topUpHint}>
                    Баланс только для оплаты тарифа платформы. Пополнение не сдвигает активный период —
                    списание происходит при наступлении NextChargeAt и достаточном балансе (без минуса).
                    Билеты идут через ЮKassa (сплит). Сейчас оплата — stub, как у билетов.
                  </p>
                </div>
              </div>

              <div>
                <TariffPlansPicker
                  tariffs={allTariffs}
                  validators={validators}
                  walletTariffId={wallet?.tariffId}
                  walletEffectiveTariffId={wallet?.effectiveTariffId}
                  isSelectedTariffActive={wallet?.isSelectedTariffActive}
                  pickedTariffId={selectedTariffId}
                  onPick={setSelectedTariffId}
                  onCancel={() => setSelectedTariffId('')}
                  onConfirm={() => { void handleSetTariff(); }}
                  confirming={saving}
                />
              </div>

              <div className={styles.historySection}>
                <div className={styles.tariffHeader}>
                  <div>
                    <div className={styles.sectionTitle}>История операций</div>
                    <div className={styles.sectionSubtitle}>
                      Пополнения и списания тарифа, плюс билеты (ЮKassa). Баланс выше — только тариф.
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
