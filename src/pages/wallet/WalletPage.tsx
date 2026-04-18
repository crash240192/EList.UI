// pages/wallet/WalletPage.tsx

import { useState, useEffect } from 'react';
import { createWallet, getWalletByAccount, setWalletTariff, type IWallet } from '@/entities/user/walletApi';
import { tariffApi, tariffValidatorApi, type ITariff, type ITariffValidator } from '@/entities/admin/adminApi';
import { getOrFetchAccountId } from '@/entities/user/api';
import styles from './WalletPage.module.css';

export default function WalletPage() {
  const [wallet,    setWallet]    = useState<IWallet | null>(null);
  const [tariff,    setTariff]    = useState<ITariff | null>(null);
  const [validator, setValidator] = useState<ITariffValidator | null>(null);
  const [allTariffs, setAllTariffs] = useState<ITariff[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const accountId = await getOrFetchAccountId();
      let w = await getWalletByAccount(accountId);

      // Кошелька нет — создаём автоматически
      if (!w) {
        w = await createWallet();
      }
      setWallet(w);

      const tariffs = await tariffApi.getAll().catch(() => []);
      setAllTariffs(tariffs);

      if (w?.tariffId) {
        const t = tariffs.find(x => x.id === w!.tariffId) ?? null;
        setTariff(t);
        if (t?.validatorId) {
          const v = await tariffValidatorApi.getByTariff(t.id).catch(() => null);
          setValidator(v);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateWallet = async () => {
    setCreating(true);
    try {
      const w = await createWallet();
      setWallet(w);
      setMsg({ text: 'Кошелёк создан', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка создания', ok: false });
    } finally { setCreating(false); }
  };

  const handleSetTariff = async () => {
    if (!wallet || !selectedTariffId) return;
    setSaving(true); setMsg(null);
    try {
      await setWalletTariff(wallet.id, selectedTariffId);
      setMsg({ text: 'Тариф подключён', ok: true });
      setSelecting(false);
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
    } finally { setSaving(false); }
  };

  if (loading) return <div className={styles.page}><div className={styles.loader}>Загрузка...</div></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>💳 Кошелёк</h1>
      </div>

      {msg && (
        <div className={`${styles.msg} ${msg.ok ? styles.msgOk : styles.msgErr}`}>
          {msg.text}
        </div>
      )}

      {wallet && (
        <div className={styles.content}>

          {/* Карточка кошелька */}
          <div className={styles.walletCard}>
            <div className={styles.walletCardHeader}>
              <span className={styles.walletLabel}>Баланс</span>
              {wallet.id && <span className={styles.walletId}>ID: {wallet.id.slice(0, 8)}...</span>}
            </div>
            <div className={styles.walletBalance}>
              {(wallet.balance ?? 0).toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {/* Текущий тариф */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Тарифный план</h2>

            {tariff ? (
              <div className={styles.tariffCard}>
                <div className={styles.tariffHeader}>
                  <div>
                    <div className={styles.tariffName}>{tariff.name}</div>
                    <div className={styles.tariffCost}>
                      {tariff.cost === 0
                        ? 'Бесплатно'
                        : `${tariff.cost.toLocaleString('ru-RU')} ₽`}
                      {' · '}
                      {(tariff as any).periodDays ?? tariff.period?.days ?? '?'} дней
                    </div>
                  </div>
                  <span className={styles.tariffBadge}>Активен</span>
                </div>

                {validator && (
                  <div className={styles.validatorGrid}>
                    <ValidatorRow
                      label="Приватные события"
                      value={validator.allowPrivate ? 'Разрешены' : 'Недоступны'}
                      type={validator.allowPrivate ? 'ok' : 'no'}
                    />
                    <ValidatorRow
                      label="Фильтр участников по полу"
                      value={validator.allowGenderSegregation ? 'Разрешён' : 'Недоступен'}
                      type={validator.allowGenderSegregation ? 'ok' : 'no'}
                    />
                    <ValidatorRow
                      label="Макс. стоимость события"
                      value={validator.costLimit == null ? 'Без ограничений' : validator.costLimit === 0 ? 'Только бесплатные события' : `до ${validator.costLimit.toLocaleString()} ₽`}
                      type={validator.costLimit == null ? 'ok' : validator.costLimit === 0 ? 'no' : 'warn'}
                    />
                    <ValidatorRow
                      label="Макс. участников события"
                      value={validator.personsLimit == null ? 'Без ограничений' : validator.personsLimit === 0 ? 'Нельзя ограничивать участников' : `до ${validator.personsLimit} чел.`}
                      type={validator.personsLimit == null ? 'ok' : validator.personsLimit === 0 ? 'no' : 'warn'}
                    />
                    <ValidatorRow
                      label="Возрастные ограничения"
                      value={validator.ageLimit == null ? 'Без ограничений' : validator.ageLimit === 0 ? 'Нельзя ставить возрастной ценз' : `до ${validator.ageLimit}+ включительно`}
                      type={validator.ageLimit == null ? 'ok' : validator.ageLimit === 0 ? 'no' : 'warn'}
                    />
                  </div>
                )}

                <button className={styles.changeTariffBtn} onClick={() => setSelecting(true)}>
                  Сменить тариф
                </button>
              </div>
            ) : (
              <div className={styles.noTariff}>
                <p>Тариф не выбран. Выберите тарифный план для доступа к расширенным возможностям.</p>
                <button className={styles.selectTariffBtn} onClick={() => setSelecting(true)}>
                  Выбрать тариф
                </button>
              </div>
            )}
          </div>

          {/* Выбор тарифа */}
          {selecting && allTariffs.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Выбор тарифа</h2>
              <div className={styles.tariffList}>
                {allTariffs.map(t => (
                  <TariffOption
                    key={t.id}
                    tariff={t}
                    selected={selectedTariffId === t.id}
                    onSelect={() => setSelectedTariffId(prev => prev === t.id ? '' : t.id)}
                  />
                ))}
              </div>
              <div className={styles.selectActions}>
                <button className={styles.cancelBtn} onClick={() => { setSelecting(false); setSelectedTariffId(''); }}>
                  Отмена
                </button>
                <button className={styles.confirmBtn} onClick={handleSetTariff}
                  disabled={!selectedTariffId || saving}>
                  {saving ? 'Подключение...' : 'Подключить'}
                </button>
              </div>
            </div>
          )}

          {selecting && allTariffs.length === 0 && (
            <div className={styles.noTariff}>
              <p>Тарифы пока не добавлены. Обратитесь к администратору.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function TariffOption({ tariff, selected, onSelect }: {
  tariff: ITariff;
  selected: boolean;
  onSelect: () => void;
}) {
  const [validator, setValidator] = useState<ITariffValidator | null>(null);
  const [loading,   setLoading]   = useState(false);

  // Загружаем валидатор при первом раскрытии
  useEffect(() => {
    if (!selected || validator || loading || !tariff.validatorId) return;
    setLoading(true);
    tariffValidatorApi.getByTariff(tariff.id)
      .then(v => setValidator(v))
      .finally(() => setLoading(false));
  }, [selected]);

  const days = (tariff as any).periodDays ?? tariff.period?.days ?? '?';

  return (
    <div
      className={`${styles.tariffOption} ${selected ? styles.tariffOptionSelected : ''}`}
      onClick={onSelect}
    >
      {/* Заголовок */}
      <div className={styles.tariffOptionHeader}>
        <div className={styles.tariffOptionInfo}>
          <span className={styles.tariffOptionName}>{tariff.name}</span>
          <span className={styles.tariffOptionCost}>
            {tariff.cost === 0 ? 'Бесплатно' : `${tariff.cost.toLocaleString('ru-RU')} ₽`}
            {' · '}
            {days} {Number(days) === 1 ? 'день' : Number(days) < 5 ? 'дня' : 'дней'}
          </span>
        </div>
        <div className={styles.tariffOptionRight}>
          {selected
            ? <span className={styles.checkMark}>✓</span>
            : <span className={styles.expandHint}>нажмите для выбора</span>}
        </div>
      </div>

      {/* Подробности — только когда выбран */}
      {selected && (
        <div className={styles.tariffDetails} onClick={e => e.stopPropagation()}>
          {loading && <div className={styles.detailsLoader}>Загрузка ограничений...</div>}
          {!loading && validator && (
            <div className={styles.detailsGrid}>
              <DetailRow
                label="Приватные события"
                value={validator.allowPrivate ? 'Разрешены' : 'Недоступны'}
                type={validator.allowPrivate ? 'ok' : 'no'}
              />
              <DetailRow
                label="Фильтр по полу"
                value={validator.allowGenderSegregation ? 'Разрешён' : 'Недоступен'}
                type={validator.allowGenderSegregation ? 'ok' : 'no'}
              />
              <DetailRow
                label="Макс. стоимость события"
                value={validator.costLimit == null ? 'Без ограничений' : validator.costLimit === 0 ? 'Только бесплатные' : `до ${validator.costLimit.toLocaleString()} ₽`}
                type={validator.costLimit == null ? 'ok' : validator.costLimit === 0 ? 'no' : 'warn'}
              />
              <DetailRow
                label="Макс. участников"
                value={validator.personsLimit == null ? 'Без ограничений' : validator.personsLimit === 0 ? 'Нельзя ограничивать' : `до ${validator.personsLimit} чел.`}
                type={validator.personsLimit == null ? 'ok' : validator.personsLimit === 0 ? 'no' : 'warn'}
              />
              <DetailRow
                label="Макс. возраст ограничения"
                value={validator.ageLimit == null ? 'Без ограничений' : validator.ageLimit === 0 ? 'Нельзя ставить ценз' : `до ${validator.ageLimit}+`}
                type={validator.ageLimit == null ? 'ok' : validator.ageLimit === 0 ? 'no' : 'warn'}
              />
            </div>
          )}
          {!loading && !validator && (
            <p className={styles.detailsLoader}>Нет данных об ограничениях</p>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, type }: { label: string; value: string; type: 'ok' | 'warn' | 'no' }) {
  const icons   = { ok: '✓', warn: '~', no: '✗' };
  const classes = { ok: styles.valOk, warn: styles.valWarn, no: styles.valNo };
  return (
    <div className={`${styles.detailRow} ${classes[type]}`}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>
        <span className={styles.valIcon}>{icons[type]}</span>
        {value}
      </span>
    </div>
  );
}

function ValidatorRow({ label, value, type }: {
  label: string;
  value: string;
  type: 'ok' | 'warn' | 'no';
}) {
  const icons   = { ok: '✓', warn: '~', no: '✗' };
  const classes = { ok: styles.valOk, warn: styles.valWarn, no: styles.valNo };
  return (
    <div className={`${styles.validatorRow} ${classes[type]}`}>
      <span className={styles.validatorLabel}>{label}</span>
      <span className={styles.validatorValue}>
        <span className={styles.valIcon}>{icons[type]}</span>
        {value}
      </span>
    </div>
  );
}
