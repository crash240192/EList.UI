// features/wallet/TariffPlansPicker.tsx — карточки тарифов (личный кошелёк и орг. финансы)

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ITariff, ITariffValidator } from '@/entities/admin/adminApi';
import { formatTariffAgeCapability } from '@/shared/lib/ageLimit';
import styles from './TariffPlansPicker.module.css';

const TARIFF_CAROUSEL_MIN = 4;

export function formatValidatorRows(
  v: ITariffValidator,
): { label: string; value: string; type: 'ok' | 'warn' | 'no' }[] {
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
      value: v.costLimit == null
        ? 'Без ограничений'
        : v.costLimit === 0
          ? 'Только бесплатные'
          : `до ${v.costLimit.toLocaleString()} ₽`,
      type: v.costLimit == null ? 'ok' : v.costLimit === 0 ? 'no' : 'warn',
    },
    {
      label: 'Макс. участников',
      value: v.personsLimit == null
        ? 'Без ограничений'
        : v.personsLimit === 0
          ? 'Нельзя ограничивать'
          : `до ${v.personsLimit} чел.`,
      type: v.personsLimit == null ? 'ok' : v.personsLimit === 0 ? 'no' : 'warn',
    },
    {
      label: 'Возрастной ценз',
      value: formatTariffAgeCapability(v.ageLimit),
      type: v.ageLimit == null ? 'ok' : v.ageLimit === 0 ? 'no' : 'warn',
    },
  ];
}

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

function TariffCard({
  tariff,
  validator,
  isSelectedPlan,
  isActive,
  isEffectiveFallback,
  isPicked,
  onSelect,
}: {
  tariff: ITariff;
  validator: ITariffValidator | null;
  isSelectedPlan: boolean;
  isActive: boolean;
  isEffectiveFallback: boolean;
  isPicked: boolean;
  onSelect: () => void;
}) {
  const days = (tariff as { periodDays?: number }).periodDays ?? tariff.period?.days ?? '?';
  const rows = validator ? formatValidatorRows(validator) : null;

  const cardClass = [
    styles.tc,
    isActive ? styles.tcCurrent : '',
    isSelectedPlan && !isActive ? styles.tcInactiveSelected : '',
    isEffectiveFallback ? styles.tcFallback : '',
    isPicked && !isSelectedPlan ? styles.tcSelected : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      onClick={isSelectedPlan && isActive ? undefined : onSelect}
      role="button"
      tabIndex={isSelectedPlan && isActive ? -1 : 0}
      aria-pressed={isPicked}
      aria-disabled={isSelectedPlan && isActive}
      onKeyDown={e => { if (e.key === 'Enter' && !(isSelectedPlan && isActive)) onSelect(); }}
    >
      {isActive && <div className={`${styles.tcBadge} ${styles.tcBadgeActive}`}>Активен</div>}
      {isSelectedPlan && !isActive && (
        <div className={`${styles.tcBadge} ${styles.tcBadgeInactive}`}>Выбран · неактивен</div>
      )}
      {isEffectiveFallback && (
        <div className={`${styles.tcBadge} ${styles.tcBadgeFallback}`}>По умолчанию</div>
      )}
      <div className={styles.tcName}>{tariff.name}</div>
      <div className={`${styles.tcPrice} ${tariff.cost === 0 ? styles.tcPriceFree : ''}`}>
        {tariff.cost === 0 ? '0 ₽' : `${tariff.cost.toLocaleString('ru-RU')} ₽`}
      </div>
      <div className={styles.tcPeriod}>
        {tariff.cost === 0 ? 'навсегда / fallback' : `в месяц · ${days} дн.`}
      </div>
      <div className={styles.tcDivider} />
      <div className={styles.tcFeat}>
        {!rows && <div className={styles.detailsLoader}>Нет данных об ограничениях</div>}
        {rows?.map(row => (
          <div key={row.label} className={styles.tcRow}>
            <div
              className={`${styles.tcRowIcon} ${row.type === 'ok' ? styles.iconOk : row.type === 'warn' ? styles.iconWarn : styles.iconNo}`}
              aria-hidden
            />
            <div className={styles.tcRowText}>{row.label}: {row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TariffPlansPicker({
  tariffs,
  validators,
  walletTariffId,
  walletEffectiveTariffId,
  isSelectedTariffActive,
  pickedTariffId,
  onPick,
  onConfirm,
  onCancel,
  confirming = false,
  title = 'Тарифный план',
  subtitle = 'Выберите план для доступа к расширенным возможностям создания событий',
  emptyText = 'Тарифы пока не добавлены. Обратитесь к администратору.',
  confirmLabel = 'Подключить',
  disabled = false,
}: {
  tariffs: ITariff[];
  validators: Record<string, ITariffValidator | null>;
  walletTariffId?: string | null;
  walletEffectiveTariffId?: string | null;
  isSelectedTariffActive?: boolean;
  pickedTariffId: string;
  onPick: (tariffId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
  title?: string;
  subtitle?: string;
  emptyText?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const selectedId = walletTariffId ?? null;
  const effectiveId = walletEffectiveTariffId ?? null;

  return (
    <div>
      <div className={styles.tariffHeader}>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          <div className={styles.sectionSubtitle}>{subtitle}</div>
        </div>
      </div>

      {tariffs.length === 0 ? (
        <div className={styles.noTariff}>{emptyText}</div>
      ) : (
        <>
          <TariffPlansCarousel count={tariffs.length}>
            {tariffs.map(t => (
              <TariffCard
                key={t.id}
                tariff={t}
                validator={validators[t.id] ?? null}
                isSelectedPlan={selectedId === t.id}
                isActive={Boolean(
                  selectedId === t.id && (isSelectedTariffActive || t.cost <= 0),
                )}
                isEffectiveFallback={Boolean(
                  effectiveId === t.id
                  && selectedId
                  && selectedId !== t.id,
                )}
                isPicked={pickedTariffId === t.id}
                onSelect={() => {
                  if (disabled) return;
                  onPick(pickedTariffId === t.id ? '' : t.id);
                }}
              />
            ))}
          </TariffPlansCarousel>
          {pickedTariffId && pickedTariffId !== selectedId && !disabled && (
            <div className={styles.selectActions}>
              <button type="button" className={styles.cancelBtn} onClick={onCancel}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={onConfirm}
                disabled={confirming}
              >
                {confirming ? 'Подключение...' : confirmLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
