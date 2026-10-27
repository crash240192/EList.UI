// features/wallet/TariffPlansPicker.tsx — карточки тарифов (личный / орг)

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ITariff, ITariffValidator } from '@/entities/admin/adminApi';
import { formatTariffPeriod } from '@/entities/admin/adminApi';
import { formatTariffAgeCapability } from '@/shared/lib/ageLimit';
import styles from './TariffPlansPicker.module.css';

const TARIFF_CAROUSEL_MIN = 4;

export type TariffPlanAction =
  | { type: 'current' }
  | { type: 'buy'; label: string }
  | { type: 'extend'; label: string }
  | { type: 'upgrade'; label: string }
  | { type: 'locked'; label: string };

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

function formatUntilShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const end = new Date(iso);
  const ms = end.getTime() - Date.now();
  if (ms < 48 * 60 * 60 * 1000) {
    return end.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** CTA для PeriodPurchase по отношению к текущему entitlement. */
export function resolvePeriodPurchaseAction(
  target: ITariff,
  current: ITariff | null,
  opts: {
    isCurrentActive: boolean;
    activeUntil?: string | null;
  },
): TariffPlanAction {
  const periodLabel = formatTariffPeriod(target);
  const price = `${target.cost.toLocaleString('ru-RU')} ₽`;
  const untilLabel = formatUntilShort(opts.activeUntil);

  const currentActivePaid = Boolean(
    opts.isCurrentActive && current && current.cost > 0,
  );

  if (target.cost <= 0) {
    if (currentActivePaid) {
      return { type: 'locked', label: untilLabel ? `После ${untilLabel}` : 'После окончания периода' };
    }
    if (current && current.id === target.id) {
      return { type: 'current' };
    }
    return { type: 'current' };
  }

  if (currentActivePaid && current) {
    if (current.id === target.id) {
      return { type: 'extend', label: `Продлить · ${price}` };
    }
    if (target.cost > current.cost) {
      return { type: 'upgrade', label: `Улучшить · от ${price}` };
    }
    return { type: 'locked', label: untilLabel ? `После ${untilLabel}` : 'После окончания периода' };
  }

  return { type: 'buy', label: `Купить · ${price} / ${periodLabel}` };
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
  periodAction,
  onPeriodAction,
  periodBusy,
  showPeriodCta,
}: {
  tariff: ITariff;
  validator: ITariffValidator | null;
  isSelectedPlan: boolean;
  isActive: boolean;
  isEffectiveFallback: boolean;
  isPicked: boolean;
  onSelect?: () => void;
  periodAction?: TariffPlanAction;
  onPeriodAction?: () => void;
  periodBusy?: boolean;
  showPeriodCta?: boolean;
}) {
  const periodLabel = formatTariffPeriod(tariff);
  const rows = validator ? formatValidatorRows(validator) : null;
  const periodMode = Boolean(periodAction);

  const cardClass = [
    styles.tc,
    isActive ? styles.tcCurrent : '',
    !periodMode && isSelectedPlan && !isActive ? styles.tcInactiveSelected : '',
    isEffectiveFallback ? styles.tcFallback : '',
    (!periodMode && isPicked && !isSelectedPlan) || (periodMode && isPicked) ? styles.tcSelected : '',
  ].filter(Boolean).join(' ');

  const clickable = Boolean(onSelect);

  return (
    <div
      className={cardClass}
      onClick={clickable ? onSelect : undefined}
      role={clickable ? 'button' : 'group'}
      tabIndex={clickable ? 0 : -1}
      aria-pressed={isPicked || undefined}
      onKeyDown={e => {
        if (!clickable || !onSelect) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {isActive && <div className={`${styles.tcBadge} ${styles.tcBadgeActive}`}>Текущий</div>}
      {!periodMode && isSelectedPlan && !isActive && (
        <div className={`${styles.tcBadge} ${styles.tcBadgeInactive}`}>Выбран · неактивен</div>
      )}
      {isEffectiveFallback && (
        <div className={`${styles.tcBadge} ${styles.tcBadgeFallback}`}>По умолчанию</div>
      )}
      <div className={styles.tcName}>{tariff.name}</div>
      <div className={styles.tcPriceRow}>
        <span className={`${styles.tcPrice} ${tariff.cost === 0 ? styles.tcPriceFree : ''}`}>
          {tariff.cost === 0 ? '0 ₽' : `${tariff.cost.toLocaleString('ru-RU')} ₽`}
        </span>
        <span className={styles.tcPeriod}>
          {tariff.cost === 0 ? 'базовый' : periodLabel}
        </span>
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

      {periodAction && showPeriodCta && (
        <div className={styles.tcAction}>
          {periodAction.type === 'current' ? (
            <span className={styles.tcActionMuted}>Текущий план</span>
          ) : periodAction.type === 'locked' ? (
            <span className={styles.tcActionMuted}>{periodAction.label}</span>
          ) : (
            <button
              type="button"
              className={styles.tcActionBtn}
              disabled={periodBusy}
              onClick={(e) => {
                e.stopPropagation();
                onPeriodAction?.();
              }}
            >
              {periodBusy ? '…' : periodAction.label}
            </button>
          )}
        </div>
      )}
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
  title = 'Планы',
  subtitle,
  emptyText = 'Тарифы пока не добавлены. Обратитесь к администратору.',
  confirmLabel = 'Подключить',
  disabled = false,
  mode = 'periodPurchase',
  currentTariff = null,
  activeUntil = null,
  onPeriodPurchase,
  purchasingTariffId = null,
}: {
  tariffs: ITariff[];
  validators: Record<string, ITariffValidator | null>;
  walletTariffId?: string | null;
  walletEffectiveTariffId?: string | null;
  isSelectedTariffActive?: boolean;
  pickedTariffId?: string;
  onPick?: (tariffId: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirming?: boolean;
  title?: string;
  subtitle?: string;
  emptyText?: string;
  confirmLabel?: string;
  disabled?: boolean;
  mode?: 'periodPurchase' | 'legacy';
  currentTariff?: ITariff | null;
  activeUntil?: string | null;
  onPeriodPurchase?: (tariffId: string) => void;
  purchasingTariffId?: string | null;
}) {
  const selectedId = walletTariffId ?? null;
  const effectiveId = walletEffectiveTariffId ?? null;
  const periodMode = mode === 'periodPurchase';
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    setFocusedId(null);
  }, [walletTariffId, tariffs.length]);

  return (
    <div>
      <div className={styles.tariffHeader}>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          {subtitle ? <div className={styles.sectionSubtitle}>{subtitle}</div> : null}
        </div>
      </div>

      {tariffs.length === 0 ? (
        <div className={styles.noTariff}>{emptyText}</div>
      ) : (
        <>
          <TariffPlansCarousel count={tariffs.length}>
            {tariffs.map(t => {
              const isActive = Boolean(
                selectedId === t.id && (isSelectedTariffActive || t.cost <= 0),
              );
              const periodAction = periodMode
                ? resolvePeriodPurchaseAction(t, currentTariff, {
                    isCurrentActive: Boolean(isSelectedTariffActive),
                    activeUntil,
                  })
                : undefined;
              const isFocused = periodMode
                ? focusedId === t.id
                : pickedTariffId === t.id;

              return (
                <TariffCard
                  key={t.id}
                  tariff={t}
                  validator={validators[t.id] ?? null}
                  isSelectedPlan={selectedId === t.id}
                  isActive={isActive || (periodMode && periodAction?.type === 'current' && t.cost <= 0 && !currentTariff?.cost)}
                  isEffectiveFallback={Boolean(
                    !periodMode
                    && effectiveId === t.id
                    && selectedId
                    && selectedId !== t.id,
                  )}
                  isPicked={isFocused}
                  onSelect={() => {
                    if (disabled) return;
                    if (periodMode) {
                      setFocusedId(prev => (prev === t.id ? null : t.id));
                      return;
                    }
                    if (!onPick) return;
                    onPick(pickedTariffId === t.id ? '' : t.id);
                  }}
                  periodAction={disabled ? { type: 'locked', label: 'Нет доступа' } : periodAction}
                  onPeriodAction={() => onPeriodPurchase?.(t.id)}
                  periodBusy={purchasingTariffId === t.id}
                  showPeriodCta={periodMode && isFocused}
                />
              );
            })}
          </TariffPlansCarousel>
          {!periodMode && pickedTariffId && pickedTariffId !== selectedId && !disabled && (
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
