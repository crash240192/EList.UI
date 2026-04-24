// pages/home/FilterBar.tsx

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EventViewMode, IEventType } from '@/entities/event';
import { fetchEventTypes } from '@/entities/event';
import { useFiltersStore } from '@/app/store';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import type { ICity } from '@/features/auth/useGeoCity';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import { cookies } from '@/shared/lib/cookies';
import styles from './FilterBar.module.css';

const DEFAULT_RADIUS_M = 25000; // 25 км по умолчанию

interface FilterBarProps {
  searchName: string;
  onSearchChange: (v: string) => void;
  viewMode: EventViewMode;
  onViewModeChange: (v: EventViewMode) => void;
  onSearch: () => void;
  /** Скрыть фильтр города (напр. на странице «Мои мероприятия») */
  hideCity?: boolean;
  /** Дополнительные вкладки над строкой поиска */
  tabs?: { key: string; label: string }[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

function todayRange()    { const d = new Date(); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59); return { s: d.toISOString(), e: e.toISOString() }; }
function tomorrowRange() { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59); return { s: d.toISOString(), e: e.toISOString() }; }
function weekendRange()  {
  const d = new Date(); const day = d.getDay();
  const sat = new Date(d); sat.setDate(d.getDate() + ((6 - day + 7) % 7 || 7)); sat.setHours(0,0,0,0);
  const sun = new Date(sat); sun.setDate(sat.getDate()+1); sun.setHours(23,59,59);
  return { s: sat.toISOString(), e: sun.toISOString() };
}

function icoSrc(ico: string) {
  return (ico.startsWith('data:') || ico.startsWith('http') || ico.startsWith('/'))
    ? ico : `data:image/png;base64,${ico}`;
}

export function FilterBar({
  searchName, onSearchChange, viewMode, onViewModeChange, onSearch,
  hideCity = false, tabs, activeTab, onTabChange,
}: FilterBarProps) {
  const { filters, setFilter, resetFilters } = useFiltersStore();
  const [allTypes,       setAllTypes]       = useState<IEventType[]>([]);
  const [expanded,       setExpanded]       = useState(false);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [showCity,       setShowCity]       = useState(false);
  const [cityName,       setCityName]       = useState(() => cookies.get('elist_city_name') ?? '');
  const [draftTypes,     setDraftTypes]     = useState<string[]>(filters.types ?? []);
  const [draftCats,      setDraftCats]      = useState<string[]>(filters.categories ?? []);
  type QuickDate = 'today'|'tomorrow'|'weekend'|null;
  const [quickDate,      setQuickDate]      = useState<QuickDate>(null);

  // Для portal-позиции дропдауна города
  const cityBtnRef = useRef<HTMLButtonElement>(null);
  const [cityDropStyle, setCityDropStyle] = useState<React.CSSProperties>({});

  useEffect(() => { fetchEventTypes().then(setAllTypes).catch(() => {}); }, []);

  // Подставляем координаты и радиус по умолчанию
  const storedCoords = getStoredUserCoords();
  const savedLocation = useRef<{ lat?: number; lng?: number; range?: number } | null>(null);

  useEffect(() => {
    if (hideCity) {
      // Сохраняем текущие координаты чтобы восстановить при возвращении на главную
      savedLocation.current = {
        lat:   filters.latitude,
        lng:   filters.longitude,
        range: filters.locationRange,
      };
      setFilter('latitude',      undefined);
      setFilter('longitude',     undefined);
      setFilter('locationRange', undefined);

      return () => {
        // При размонтировании (уход со страницы) — восстанавливаем координаты
        const saved = savedLocation.current;
        if (saved?.lat !== undefined) setFilter('latitude',  saved.lat);
        if (saved?.lng !== undefined) setFilter('longitude', saved.lng);
        if (saved?.range !== undefined) setFilter('locationRange', saved.range);
        else setFilter('locationRange', DEFAULT_RADIUS_M);
      };
    } else {
      if (!filters.latitude && storedCoords.lat !== 0) {
        setFilter('latitude',  storedCoords.lat);
        setFilter('longitude', storedCoords.lng);
      }
      if (!filters.locationRange) setFilter('locationRange', DEFAULT_RADIUS_M);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideCity]);

  // Вычисляем позицию дропдауна города через portal
  useEffect(() => {
    if (!showCity || !cityBtnRef.current) return;
    const r = cityBtnRef.current.getBoundingClientRect();
    setCityDropStyle({
      position: 'fixed',
      top: r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - 296),
      width: 280,
      zIndex: 9999,
    });
    // Закрытие по клику вне
    const fn = (e: MouseEvent) => {
      if (cityBtnRef.current?.contains(e.target as Node)) return;
      const drop = document.querySelector('[data-city-drop]');
      if (!drop?.contains(e.target as Node)) setShowCity(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [showCity]);

  const handleCitySelect = (city: ICity) => {
    const name = city.shortName ?? city.name;
    setCityName(name);
    cookies.set('elist_city_name', name, 30);
    setFilter('latitude',  city.lat);
    setFilter('longitude', city.lng);
    setShowCity(false);
    window.dispatchEvent(new CustomEvent('elist:centerMap', { detail: { lat: city.lat, lng: city.lng } }));
  };

  const handleQuickDate = (key: QuickDate) => {
    if (quickDate === key) { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); return; }
    setQuickDate(key);
    const r = key === 'today' ? todayRange() : key === 'tomorrow' ? tomorrowRange() : weekendRange();
    setFilter('startTime', r.s); setFilter('endTime', r.e);
  };

  const toggleType = (id: string) => {
    const next = draftTypes.includes(id) ? draftTypes.filter(x => x !== id) : [...draftTypes, id];
    setDraftTypes(next);
    // Сразу применяем — быстрые иконки работают как тогглы с мгновенным поиском
    setFilter('types', next.length ? next : undefined);
    onSearch();
  };

  const handleApply = () => {
    setFilter('categories', draftCats.length  ? draftCats  : undefined);
    setFilter('types',      draftTypes.length ? draftTypes : undefined);
    setExpanded(false);
    onSearch();
  };

  const handleReset = () => {
    resetFilters();
    onSearchChange('');
    setCityName('');
    setDraftCats([]);
    setDraftTypes([]);
    setQuickDate(null);
    setExpanded(false);
    // Восстанавливаем дефолтный радиус и координаты
    if (storedCoords.lat !== 0) {
      setFilter('latitude',  storedCoords.lat);
      setFilter('longitude', storedCoords.lng);
    }
    setFilter('locationRange', DEFAULT_RADIUS_M);
  };

  // Чипы
  const chips: { label: string; onRemove: () => void }[] = [];
  if (cityName) chips.push({ label: `📍 ${cityName}`, onRemove: () => { setCityName(''); setFilter('latitude', undefined); setFilter('longitude', undefined); } });
  if (quickDate === 'today')    chips.push({ label: 'Сегодня',  onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (quickDate === 'tomorrow') chips.push({ label: 'Завтра',   onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (quickDate === 'weekend')  chips.push({ label: 'Выходные', onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (filters.price === 0)      chips.push({ label: 'Бесплатно', onRemove: () => setFilter('price', undefined) });
  (filters.types ?? []).forEach(tid => {
    const t = allTypes.find(x => x.id === tid);
    if (t) chips.push({ label: t.name, onRemove: () => { const n = (filters.types ?? []).filter(x => x !== tid); setFilter('types', n.length ? n : undefined); setDraftTypes(n); } });
  });

  const QUICK_TYPES = allTypes.slice(0, 5);
  const hasExpandedActive = (!quickDate && !!(filters.startTime || filters.endTime)) || (!!filters.price && filters.price > 0) || (!!filters.locationRange && filters.locationRange !== DEFAULT_RADIUS_M);
  const radiusKm = filters.locationRange ? Math.round(filters.locationRange / 1000) : '';

  return (
    <>
    <div className={styles.bar}>
      {/* ── Вкладки (опционально) ── */}
      {tabs && tabs.length > 0 && (
        <div className={styles.tabsRow}>
          {tabs.map(t => (
            <button key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ''}`}
              onClick={() => onTabChange?.(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Строка поиска ── */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className={styles.searchInput} placeholder="Название мероприятия..."
            value={searchName} onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleApply()} />
          {searchName && <button className={styles.clearBtn} onClick={() => onSearchChange('')}>✕</button>}
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewActive : ''}`} onClick={() => onViewModeChange('list')} title="Список">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button className={`${styles.viewBtn} ${viewMode === 'map' ? styles.viewActive : ''}`} onClick={() => onViewModeChange('map')} title="Карта">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
        </div>
      </div>

      {/* ── Чипы ── */}
      {chips.length > 0 && (
        <div className={styles.chipsRow}>
          {chips.map((c, i) => (
            <div key={i} className={styles.chip}>{c.label}<span className={styles.chipClose} onClick={c.onRemove}>×</span></div>
          ))}
          <button className={styles.clearAll} onClick={handleReset}>Сбросить всё</button>
        </div>
      )}

      {/* ── Быстрые фильтры ── */}
      <div className={styles.quickRow}>
        {!hideCity && (
          <button ref={cityBtnRef} className={styles.cityBtn} onClick={() => setShowCity(v => !v)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {cityName || 'Город'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={showCity ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
          </button>
        )}

        {!hideCity && <div className={styles.sep}/>}
        <button className={`${styles.quickBtn} ${quickDate === 'today'    ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('today')}>Сегодня</button>
        <button className={`${styles.quickBtn} ${quickDate === 'tomorrow' ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('tomorrow')}>Завтра</button>
        <button className={`${styles.quickBtn} ${quickDate === 'weekend'  ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('weekend')}>Выходные</button>
        <button className={`${styles.quickBtn} ${filters.price === 0      ? styles.quickBtnOn : ''}`} onClick={() => filters.price === 0 ? setFilter('price', undefined) : setFilter('price', 0)}>Бесплатно</button>

        <div className={styles.sep}/>
        {QUICK_TYPES.map(t => (
          <button key={t.id} title={t.name}
            className={`${styles.quickBtn} ${styles.quickBtnIcon} ${draftTypes.includes(t.id) ? styles.quickBtnOn : ''}`}
            onClick={() => toggleType(t.id)}>
            {t.ico
              ? <img src={icoSrc(t.ico)} alt={t.name} width={14} height={14} style={{ objectFit: 'contain' }} />
              : <span style={{ fontSize: 12 }}>{t.name[0]}</span>}
          </button>
        ))}
        {/* Кнопка «Ещё типы» — открывает CategoryTypePicker */}
        <button className={`${styles.quickBtn} ${(draftTypes.length > 0 || draftCats.length > 0) ? styles.quickBtnOn : ''}`}
          onClick={() => setPickerOpen(true)}>
          Ещё&nbsp;
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <div className={styles.sep}/>
        <button className={`${styles.moreBtn} ${expanded ? styles.moreBtnOpen : ''} ${hasExpandedActive ? styles.moreBtnActive : ''}`}
          onClick={() => setExpanded(v => !v)}>
          {hasExpandedActive && <span className={styles.moreDot}/>}
          Дополнительно
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
        </button>
      </div>

      {/* ── Расширенная панель ── */}
      {expanded && (
        <div className={styles.expandPanel}>
          <div className={styles.epBlock}>
            <span className={styles.epLabel}>Дата от</span>
            <DatePicker withTime value={filters.startTime ?? ''} placeholder="Любая"
              onChange={iso => { setFilter('startTime', iso || undefined); setQuickDate(null); }} />
          </div>
          <div className={styles.epBlock}>
            <span className={styles.epLabel}>Дата до</span>
            <DatePicker withTime value={filters.endTime ?? ''} placeholder="Любая"
              onChange={iso => { setFilter('endTime', iso || undefined); setQuickDate(null); }} />
          </div>
          <div className={styles.epBlock}>
            <span className={styles.epLabel}>Цена, ₽</span>
            <input type="number" className={styles.epInput}
              placeholder="Любая" value={filters.price ?? ''}
              onChange={e => setFilter('price', e.target.value !== '' ? Number(e.target.value) : undefined)} />
          </div>
          <div className={styles.epBlock}>
            <span className={styles.epLabel}>Радиус, км</span>
            <input type="number" className={styles.epInput}
              placeholder="25" value={radiusKm}
              onChange={e => setFilter('locationRange', e.target.value !== '' ? Number(e.target.value) * 1000 : undefined)} />
          </div>
          <div className={styles.epFooter}>
            <button className={styles.epReset} onClick={handleReset}>Сбросить</button>
            <button className={styles.epApply} onClick={handleApply}>Применить</button>
          </div>
        </div>
      )}
    </div>

    {/* City dropdown через portal — не обрезается overflow родителей */}
    {showCity && createPortal(
      <div data-city-drop style={{ ...cityDropStyle, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
        <CitySearch value={cityName} onSelect={handleCitySelect} placeholder="Поиск города..." />
      </div>,
      document.body
    )}

    {pickerOpen && (
      <CategoryTypePicker
        selectedCategories={draftCats}
        selectedTypes={draftTypes}
        onChange={(cats, types) => { setDraftCats(cats); setDraftTypes(types); }}
        onClose={() => { setPickerOpen(false); handleApply(); }}
      />
    )}
    </>
  );
}
