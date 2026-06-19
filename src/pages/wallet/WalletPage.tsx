// pages/wallet/WalletPage.tsx — макет examples/elist_settings_wallet.html

import { useState, useEffect } from 'react';
import { createWallet, getWalletByAccount, setWalletTariff, type IWallet } from '@/entities/user/walletApi';
import { getMyPersonInfo } from '@/entities/user/settingsApi';
import { tariffApi, tariffValidatorApi, type ITariff, type ITariffValidator } from '@/entities/admin/adminApi';
import { getOrFetchAccountId } from '@/entities/user/api';
import styles from './WalletPage.module.css';

const HISTORY_STUB: {
  id: string;
  kind: 'in' | 'out' | 'tariff';
  icon: string;
  name: string;
  meta: string;
  amount: string;
}[] = [
  { id: '1', kind: 'in', icon: '⬇', name: 'Пополнение кошелька', meta: '15 мая 2025 · Банковская карта', amount: '+ 2 000 ₽' },
  { id: '2', kind: 'tariff', icon: '★', name: 'Тариф «Стандарт»', meta: '1 мая 2025 · Автопродление', amount: '− 490 ₽' },
  { id: '3', kind: 'out', icon: '🎫', name: 'Startup Pitch Night', meta: '18 мар 2025 · Билет на мероприятие', amount: '− 1 000 ₽' },
];

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
      value: v.ageLimit == null ? 'Без ограничений' : v.ageLimit === 0 ? 'Нельзя ставить ценз' : `до ${v.ageLimit}+`,
      type: v.ageLimit == null ? 'ok' : v.ageLimit === 0 ? 'no' : 'warn',
    },
  ];
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<IWallet | null>(null);
  const [tariff, setTariff] = useState<ITariff | null>(null);
  const [holderName, setHolderName] = useState('');
  const [allTariffs, setAllTariffs] = useState<ITariff[]>([]);
  const [validators, setValidators] = useState<Record<string, ITariffValidator | null>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const accountId = await getOrFetchAccountId();
      let w = await getWalletByAccount(accountId);
      if (!w) w = await createWallet();
      setWallet(w);

      const [tariffs, person] = await Promise.all([
        tariffApi.getAll().catch(() => []),
        getMyPersonInfo().catch(() => null),
      ]);
      setAllTariffs(tariffs);

      if (person) {
        const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
        if (name) setHolderName(name);
      }

      if (w?.tariffId) {
        const t = tariffs.find(x => x.id === w!.tariffId) ?? null;
        setTariff(t);
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
                <button type="button" className={styles.cardActionBtn} disabled title="Скоро">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  Пополнить
                </button>
                <button type="button" className={styles.cardActionBtn} disabled title="Скоро">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                  Вывести
                </button>
                <button type="button" className={styles.cardActionBtn} disabled title="Скоро">
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
              <div className={styles.topUpSection}>
                <div className={styles.sectionTitle}>Пополнение кошелька</div>
                <div className={styles.topUpStub}>
                  <div className={styles.topUpStubForm}>
                    <label className={styles.topUpLabel}>
                      Сумма пополнения
                      <div className={styles.topUpInputRow}>
                        <input
                          type="text"
                          className={styles.topUpInput}
                          placeholder="1 000"
                          disabled
                          aria-disabled
                        />
                        <span className={styles.topUpCurrency}>₽</span>
                      </div>
                    </label>
                    <button type="button" className={styles.topUpBtn} disabled>
                      Перейти к оплате
                    </button>
                  </div>
                  <p className={styles.topUpHint}>
                    Механизм пополнения в разработке. Здесь появится выбор способа оплаты: банковская карта, СБП и другие.
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
                    <div className={styles.tariffGrid}>
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
                    </div>
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
                    <div className={styles.sectionSubtitle}>Пополнения, списания и оплата тарифов</div>
                  </div>
                  <span className={styles.stubBadge}>заглушка</span>
                </div>
                <div className={styles.histList} aria-hidden>
                  {HISTORY_STUB.map(row => (
                    <div key={row.id} className={styles.histRow}>
                      <div className={`${styles.histIco} ${HIST_ICO_CLASS[row.kind]}`}>
                        {row.icon}
                      </div>
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
                <p className={styles.historyHint}>
                  Реальная история транзакций появится после подключения платёжного API.
                </p>
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
    <div className={cardClass} onClick={isCurrent ? undefined : onSelect} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' && !isCurrent) onSelect(); }}>
      {isCurrent && <div className={`${styles.tcBadge} ${styles.tcBadgeActive}`}>✓ Активен</div>}
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
            <div className={`${styles.tcRowIcon} ${row.type === 'ok' ? styles.iconOk : row.type === 'warn' ? styles.iconWarn : styles.iconNo}`}>
              {row.type === 'ok' ? '✓' : row.type === 'warn' ? '~' : '✗'}
            </div>
            <div className={styles.tcRowText}>{row.label}: {row.value}</div>
          </div>
        ))}
      </div>
      {!isCurrent && (
        <button type="button" className={styles.tcSelectBtn} onClick={e => { e.stopPropagation(); onSelect(); }}>
          Выбрать
        </button>
      )}
      {isCurrent && (
        <button type="button" className={styles.tcSelectBtn} disabled>
          Текущий план
        </button>
      )}
    </div>
  );
}
