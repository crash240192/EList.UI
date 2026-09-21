// pages/wallet/WalletPage.tsx — макет examples/elist_settings_wallet.html

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  createWallet,
  getWalletByAccount,
  setWalletTariff,
  createWalletDeposit,
  completeWalletDeposit,
  fetchWalletDeposits,
  type IWallet,
  type IWalletDeposit,
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
import { usePageTitle } from '@/shared/hooks';
import { formatTariffAgeCapability } from '@/shared/lib/ageLimit';
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

function formatValidatorRows(v: ITariffValidator): { label: string; value: string; type: 'ok' | 'warn' | 'no' }[] {
  return [
    {
      label: 'Приватные события',
      value: v.allowPrivate ? 'Разрешены' : 'Недоступны',
      type: v.allowPrivate ? 'ok' : 'no',
    },
    {
      label: 'Фильтр по полу',
      value: v.allowGenderSegregation ? 'Разрешён' : 'Недоступен',
      type: v.allowGenderSegregation ? 'ok' : 'no',
    },
    {
      label: 'Макс. стоимость',
      value: v.costLimit == null ? 'Без ограничений' : v.costLimit === 0 ? 'Только бесплатные' : `до ${v.costLimit.toLocaleString()} ₽`,
      type: v.costLimit == null ? 'ok' : v.costLimit === 0 ? 'no' : 'warn',
    },
    {
      label: 'Макс. участников',
      value: v.personsLimit == null ? 'Без ограничений' : v.personsLimit === 0 ? 'Нельзя ограничивать' : `до ${v.personsLimit} чел.`,
      type: v.personsLimit == null ? 'ok' : v.personsLimit === 0 ? 'no' : 'warn',
    },
    {
      label: 'Возрастной ценз',
      value: formatTariffAgeCapability(v.ageLimit),
      type: v.ageLimit == null ? 'ok' : v.ageLimit === 0 ? 'no' : 'warn',
    },
  ];
}

const TARIFF_CAROUSEL_MIN = 4;

function TariffPlansCarousel({ children, count }: { children: ReactNode; count: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [count, updateScrollState]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (count < TARIFF_CAROUSEL_MIN) {
    return <div className={styles.tariffGrid}>{children}</div>;
  }

  return (
    <div className={styles.tariffCarousel}>
      <button
        type="button"
        className={styles.tariffCarouselBtn}
        onClick={() => scrollByPage(-1)}
        disabled={!canScrollPrev}
        aria-label="Предыдущие тарифы"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div ref={trackRef} className={styles.tariffCarouselTrack}>
        {children}
      </div>
      <button
        type="button"
        className={styles.tariffCarouselBtn}
        onClick={() => scrollByPage(1)}
        disabled={!canScrollNext}
        aria-label="Следующие тарифы"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
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

  const loadHistory = useCallback(async (currentTariff: ITariff | null, currentWallet: IWallet | null) => {
    setHistoryLoading(true);
    try {
      // Единая лента финдеятельности: тарифный кошелёк + билеты (ЮKassa).
      // Баланс карточки при этом остаётся только тарифным.
      const rows: HistoryRow[] = [];

      if (currentWallet?.id) {
        const deposits = await fetchWalletDeposits(currentWallet.id).catch(() => [] as IWalletDeposit[]);
        for (const d of deposits.filter(x => x.status === 'Succeeded')) {
          const when = d.paidAt || d.createDate;
          const sortAt = when ? new Date(when).getTime() : 0;
          const dateLabel = when
            ? new Date(when).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            : '';
          rows.push({
            id: `deposit-${d.id}`,
            kind: 'in',
            name: 'Пополнение тарифа',
            meta: `${dateLabel} · Тариф платформы`,
            amount: `+ ${d.amount.toLocaleString('ru-RU')} ₽`,
            sortAt: Number.isFinite(sortAt) ? sortAt : 0,
          });
        }
      }

      if (currentWallet?.lastChargeDate && currentTariff) {
        const sortAt = new Date(currentWallet.lastChargeDate).getTime();
        rows.push({
          id: `tariff-${currentWallet.id}`,
          kind: 'tariff',
          name: `Тариф «${currentTariff.name}»`,
          meta: `${new Date(currentWallet.lastChargeDate).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })} · Списание тарифа`,
          amount: currentTariff.cost > 0
            ? `− ${currentTariff.cost.toLocaleString('ru-RU')} ₽`
            : '0 ₽',
          sortAt: Number.isFinite(sortAt) ? sortAt : 0,
        });
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
        const dateLabel = when
          ? new Date(when).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          : '';
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
        await loadHistory(t, w);
      } else {
        setTariff(null);
        await loadHistory(null, w);
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
      await setWalletTariff(wallet.id, selectedTariffId);
      setMsg({ text: 'Тариф подключён', ok: true });
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
                <div className={styles.cardBrand}>EList Pay</div>
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
                    Баланс только для оплаты тарифа платформы. Билеты и прочие платежи проходят через ЮKassa (сплит), не через этот кошелёк. Сейчас оплата — stub, как у билетов.
                  </p>
                </div>
              </div>

              <div>
                <div className={styles.tariffHeader}>
                  <div>
                    <div className={styles.sectionTitle}>Тарифный план</div>
                    <div className={styles.sectionSubtitle}>
                      Выберите план для доступа к расширенным возможностям создания событий
                    </div>
                  </div>
                </div>

                {allTariffs.length === 0 ? (
                  <div className={styles.noTariff}>
                    Тарифы пока не добавлены. Обратитесь к администратору.
                  </div>
                ) : (
                  <>
                    <TariffPlansCarousel count={allTariffs.length}>
                      {allTariffs.map(t => (
                        <TariffCard
                          key={t.id}
                          tariff={t}
                          validator={validators[t.id] ?? null}
                          isCurrent={tariff?.id === t.id}
                          isSelected={selectedTariffId === t.id}
                          onSelect={() => setSelectedTariffId(prev => prev === t.id ? '' : t.id)}
                        />
                      ))}
                    </TariffPlansCarousel>
                    {selectedTariffId && selectedTariffId !== tariff?.id && (
                      <div className={styles.selectActions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => setSelectedTariffId('')}>
                          Отмена
                        </button>
                        <button type="button" className={styles.confirmBtn} onClick={handleSetTariff} disabled={saving}>
                          {saving ? 'Подключение...' : 'Подключить'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={styles.historySection}>
                <div className={styles.tariffHeader}>
                  <div>
                    <div className={styles.sectionTitle}>История операций</div>
                    <div className={styles.sectionSubtitle}>
                      Вся финдеятельностьность: тариф платформы и билеты (ЮKassa). Баланс выше — только тариф.
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

function TariffCard({
  tariff,
  validator,
  isCurrent,
  isSelected,
  onSelect,
}: {
  tariff: ITariff;
  validator: ITariffValidator | null;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const days = (tariff as { periodDays?: number }).periodDays ?? tariff.period?.days ?? '?';
  const rows = validator ? formatValidatorRows(validator) : null;

  const cardClass = [
    styles.tc,
    isCurrent ? styles.tcCurrent : '',
    isSelected && !isCurrent ? styles.tcSelected : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      onClick={isCurrent ? undefined : onSelect}
      role="button"
      tabIndex={isCurrent ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={isCurrent}
      onKeyDown={e => { if (e.key === 'Enter' && !isCurrent) onSelect(); }}
    >
      {isCurrent && <div className={`${styles.tcBadge} ${styles.tcBadgeActive}`}>Активен</div>}
      <div className={styles.tcName}>{tariff.name}</div>
      <div className={`${styles.tcPrice} ${tariff.cost === 0 ? styles.tcPriceFree : ''}`}>
        {tariff.cost === 0 ? '0 ₽' : `${tariff.cost.toLocaleString('ru-RU')} ₽`}
      </div>
      <div className={styles.tcPeriod}>
        {tariff.cost === 0 ? 'навсегда' : `в месяц · ${days} дн.`}
      </div>
      <div className={styles.tcDivider} />
      <div className={styles.tcFeat}>
        {!rows && <div className={styles.detailsLoader}>Нет данных об ограничениях</div>}
        {rows?.map(row => (
          <div key={row.label} className={styles.tcRow}>
            <div className={`${styles.tcRowIcon} ${row.type === 'ok' ? styles.iconOk : row.type === 'warn' ? styles.iconWarn : styles.iconNo}`} aria-hidden />
            <div className={styles.tcRowText}>{row.label}: {row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
