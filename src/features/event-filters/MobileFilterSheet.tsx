// features/event-filters/MobileFilterSheet.tsx
// Шторка фильтров для мобильной версии

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CategoryTypePicker } from './CategoryTypePicker';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import type { ICity } from '@/features/auth/useGeoCity';
import type { IEventType } from '@/entities/event';
import type { IEventsSearchParams } from '@/entities/event';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import styles from './MobileFilterSheet.module.css';

const DEFAULT_RADIUS_M = 25000;

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  onResetCity: () => void;

  // Данные
  filters: IEventsSearchParams;
  setFilter: <K extends keyof IEventsSearchParams>(key: K, value: IEventsSearchParams[K]) => void;
  cityName: string;
  setCityName: (v: string) => void;
  quickDate: 'today'|'tomorrow'|'weekend'|null;
  setQuickDate: (v: 'today'|'tomorrow'|'weekend'|null) => void;
  draftTypes: string[];
  setDraftTypes: (v: string[]) => void;
  draftCats: string[];
  setDraftCats: (v: string[]) => void;
  allTypes: IEventType[];
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  chips: { label: string; onRemove: () => void }[];
  handleCitySelect: (city: ICity) => void;
  handleQuickDate: (key: 'today'|'tomorrow'|'weekend') => void;
}

export function MobileFilterSheet({
  open, onClose, onApply, onReset, onResetCity,
  filters, setFilter, cityName, setCityName,
  quickDate, setQuickDate,
  draftTypes, setDraftTypes, draftCats, setDraftCats,
  allTypes, pickerOpen, setPickerOpen, chips,
  handleCitySelect, handleQuickDate,
}: MobileFilterSheetProps) {

  const sheetRef = useRef<HTMLDivElement>(null);
  const radiusKm = filters.locationRange ? Math.round(filters.locationRange / 1000) : '';

  // Блокируем прокрутку body когда шторка открыта
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Закрытие по клику на бэкдроп
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div ref={sheetRef} className={styles.sheet}>
        {/* Хедер */}
        <div className={styles.header}>
          <span className={styles.title}>Фильтры</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Контент с прокруткой */}
        <div className={styles.body}>

          {/* Город */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className={styles.sectionLabel} style={{ margin: 0 }}>Город</div>
              {cityName && (
                <button onClick={onResetCity} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', padding: 0 }}>
                  ← Мой город
                </button>
              )}
            </div>
            <CitySearch value={cityName} onSelect={handleCitySelect} placeholder="Поиск города..." />
          </div>

          {/* Когда */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Когда</div>
            <div className={styles.pills}>
              {(['today','tomorrow','weekend'] as const).map(key => {
                const label = { today: 'Сегодня', tomorrow: 'Завтра', weekend: 'Выходные' }[key];
                return (
                  <button key={key}
                    className={`${styles.pill} ${quickDate === key ? styles.pillOn : ''}`}
                    onClick={() => handleQuickDate(key)}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Цена */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Цена</div>
            <div className={styles.pills}>
              <button
                className={`${styles.pill} ${filters.price === 0 ? styles.pillOn : ''}`}
                onClick={() => filters.price === 0 ? setFilter('price', undefined) : setFilter('price', 0)}>
                Бесплатно
              </button>
            </div>
          </div>

          {/* Типы мероприятий */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Тип мероприятия</div>
            <div className={styles.pills}>
              {allTypes.slice(0, 5).map(t => (
                <button key={t.id}
                  className={`${styles.pill} ${draftTypes.includes(t.id) ? styles.pillOn : ''}`}
                  onClick={() => setDraftTypes(draftTypes.includes(t.id) ? draftTypes.filter(x => x !== t.id) : [...draftTypes, t.id])}>
                  {t.ico && <img src={icoToUrl(t.ico) ?? undefined} alt="" width={12} height={12} className="event-type-ico" style={{ objectFit: 'contain' }} />}
                  {t.name}
                </button>
              ))}
              <button
                className={`${styles.pill} ${(draftCats.length > 0 || draftTypes.length > allTypes.slice(0,5).filter(t => draftTypes.includes(t.id)).length) ? styles.pillOn : ''}`}
                onClick={() => setPickerOpen(true)}>
                Все категории →
              </button>
            </div>
          </div>

          {/* Параметры */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Параметры</div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Дата от</span>
                <DatePicker withTime value={filters.startTime ?? ''} placeholder="Любая"
                  onChange={iso => { setFilter('startTime', iso || undefined); setQuickDate(null); }} />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Дата до</span>
                <DatePicker withTime value={filters.endTime ?? ''} placeholder="Любая"
                  onChange={iso => { setFilter('endTime', iso || undefined); setQuickDate(null); }} />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Цена, ₽</span>
                <input className={styles.input} type="number" min={0}
                  placeholder="Любая" value={filters.price ?? ''}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => setFilter('price', e.target.value !== '' ? Number(e.target.value) : undefined)} />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Радиус, км</span>
                <input className={styles.input} type="number" min={1} max={500}
                  placeholder="25" value={radiusKm}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => setFilter('locationRange', e.target.value !== '' ? Number(e.target.value) * 1000 : DEFAULT_RADIUS_M)} />
              </div>
            </div>
          </div>
        </div>

        {/* Футер с кнопками */}
        <div className={styles.footer}>
          <button className={styles.resetBtn} onClick={onReset}>Сбросить</button>
          <button className={styles.applyBtn} onClick={() => { onApply(); onClose(); }}>
            Показать результаты
          </button>
        </div>
      </div>

      {/* CategoryTypePicker внутри шторки */}
      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={draftCats}
          selectedTypes={draftTypes}
          onChange={(cats, types) => { setDraftCats(cats); setDraftTypes(types); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>,
    document.body
  );
}
