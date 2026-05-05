// pages/home/FilterBar.tsx

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EventViewMode, IEventType } from '@/entities/event';
import { fetchEventTypes } from '@/entities/event';
import { useFiltersStore } from '@/app/store';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';;
import { MobileFilterSheet } from '@/features/event-filters/MobileFilterSheet';
import { CitySearch } from '@/shared/ui/CitySearch/CitySearch';
import { DatePicker } from '@/shared/ui/DatePicker/DatePicker';
import type { ICity } from '@/features/auth/useGeoCity';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import { cookies } from '@/shared/lib/cookies';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import styles from './FilterBar.module.css';

const DEFAULT_RADIUS_M = 25000; // 25 км по умолчанию

interface FilterBarProps {
  searchName: string;
  onSearchChange: (v: string) => void;
  viewMode: EventViewMode;
  onViewModeChange: (v: EventViewMode) => void;
  onSearch: () => void;
  useStore?: typeof useFiltersStore;
  hideCity?: boolean;
  hideViewToggle?: boolean;
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

export function FilterBar({
  searchName, onSearchChange, viewMode, onViewModeChange, onSearch,
  useStore: useStoreOverride, hideCity = false, hideViewToggle = false, tabs, activeTab, onTabChange,
}: FilterBarProps) {
  const storeDefault = useFiltersStore();
  const storeOverride = useStoreOverride?.();
  const { filters, setFilter, resetFilters } = storeOverride ?? storeDefault;
  const [allTypes,       setAllTypes]       = useState<IEventType[]>([]);
  const [expanded,       setExpanded]       = useState(false);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [showCity,       setShowCity]       = useState(false);
  const [mobileSheet,    setMobileSheet]    = useState(false);
  const [cityName, setCityName] = useState(() =>
    cookies.get('elist_home_city_name') ?? cookies.get('elist_city_name') ?? ''
  );

  // Подставляем координаты и радиус по умолчанию
  const storedCoords = getStoredUserCoords();

  // Синхронизируем название города если пользователь сменил его в настройках
  useEffect(() => {
    const savedName = cookies.get('elist_city_name') ?? '';
    setCityName(savedName);
  }, [storedCoords.lat, storedCoords.lng]);
  const [draftTypes,     setDraftTypes]     = useState<string[]>(filters.types ?? []);
  const [draftCats,      setDraftCats]      = useState<string[]>(filters.categories ?? []);
  type QuickDate = 'today'|'tomorrow'|'weekend'|null;
  const [quickDate,      setQuickDate]      = useState<QuickDate>(null);

  // Храним onSearch в ref чтобы избежать stale closure в слушателях событий
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);
  const radiusDebounce = useRef<ReturnType<typeof setTimeout>>();

  // Слушаем «Искать здесь» от карты
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng, radius } = (e as CustomEvent<{ lat: number; lng: number; radius: number }>).detail;
      setCityName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      // Все три setFilter — Zustand обновит стор, useEvents среагирует автоматически
      useFiltersStore.getState().setFilter('latitude',      lat);
      useFiltersStore.getState().setFilter('longitude',     lng);
      useFiltersStore.getState().setFilter('locationRange', radius);
    };
    window.addEventListener('elist:searchHere', handler);
    return () => window.removeEventListener('elist:searchHere', handler);
  }, []);

  // Для portal-позиции дропдауна города
  const cityBtnRef = useRef<HTMLButtonElement>(null);
  const [cityDropStyle, setCityDropStyle] = useState<React.CSSProperties>({});

  useEffect(() => { fetchEventTypes().then(setAllTypes).catch(() => {}); }, []);

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
        // При первом заходе всегда берём РОДНОЙ город, игнорируя предыдущий поиск
        const homeName = cookies.get('elist_home_city_name') ?? cookies.get('elist_city_name') ?? '';
        setCityName(homeName);
        if (homeName) cookies.set('elist_city_name', homeName, 30);
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
    // Обновляем центр карты в сторе — работает и при режиме «список»
    useFiltersStore.getState().setMapCenter([city.lat, city.lng]);
    useFiltersStore.getState().setMapZoom(12);
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

  // Вспомогательная функция — возврат к родному городу
  const restoreHomeCity = () => {
    // Берём РОДНОЙ город из отдельной cookie (не поисковый фильтр)
    const homeName = cookies.get('elist_home_city_name') ?? cookies.get('elist_city_name') ?? '';
    setCityName(homeName);
    const home = storedCoords.lat !== 0 ? storedCoords : null;
    if (home) {
      setFilter('latitude',  home.lat);
      setFilter('longitude', home.lng);
      useFiltersStore.getState().setMapCenter([home.lat, home.lng]);
      useFiltersStore.getState().setMapZoom(12);
      window.dispatchEvent(new CustomEvent('elist:centerMap', {
        detail: { lat: home.lat, lng: home.lng },
      }));
    } else {
      setFilter('latitude', undefined);
      setFilter('longitude', undefined);
      useFiltersStore.getState().setMapCenter(null as any);
    }
    setFilter('locationRange', DEFAULT_RADIUS_M);
  };

  // Слушаем обновление родного города (из диалога подтверждения)
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lng, name } = (e as CustomEvent<{lat:number;lng:number;name:string}>).detail;
      // Обновляем cookie родного города и текущий фильтр
      cookies.set('elist_home_city_name', name, 30);
      cookies.set('elist_city_name', name, 30);
      setCityName(name);
      setFilter('latitude', lat);
      setFilter('longitude', lng);
      useFiltersStore.getState().setMapCenter([lat, lng]);
      useFiltersStore.getState().setMapZoom(12);
      // Двигаем карту если она открыта
      window.dispatchEvent(new CustomEvent('elist:centerMap', { detail: { lat, lng } }));
    };
    window.addEventListener('elist:homeCityChanged', handler);
    return () => window.removeEventListener('elist:homeCityChanged', handler);
  }, [setFilter]);

  const handleReset = () => {
    resetFilters();
    onSearchChange('');
    setDraftCats([]);
    setDraftTypes([]);
    setQuickDate(null);
    setExpanded(false);
    restoreHomeCity();
  };

  // Чипы
  const chips: { label: string; onRemove: () => void }[] = [];
  if (cityName) chips.push({ label: `📍 ${cityName}`, onRemove: restoreHomeCity });
  if (quickDate === 'today')    chips.push({ label: 'Сегодня',  onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (quickDate === 'tomorrow') chips.push({ label: 'Завтра',   onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (quickDate === 'weekend')  chips.push({ label: 'Выходные', onRemove: () => { setQuickDate(null); setFilter('startTime', undefined); setFilter('endTime', undefined); } });
  if (filters.price === 0)      chips.push({ label: 'Бесплатно', onRemove: () => setFilter('price', undefined) });

  const QUICK_TYPES = allTypes.slice(0, 5);
  const hasExpandedActive = (!quickDate && !!(filters.startTime || filters.endTime)) || (!!filters.price && filters.price > 0) || (!!filters.locationRange && filters.locationRange !== DEFAULT_RADIUS_M);
  const radiusKm = filters.locationRange ? Math.round(filters.locationRange / 1000) : '';

  return (
    <>
    {/* ── Мобильная компактная строка (только на мобиле) ── */}
    <div className={styles.mobileBar}>
      <div className={styles.searchWrap} style={{ flex: 1 }}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input className={styles.searchInput} placeholder="Поиск..."
          value={searchName} onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleApply()} />
        {searchName && <button className={styles.clearBtn} onClick={() => onSearchChange('')}>✕</button>}
      </div>
      <button className={styles.mobileFilterBtn} onClick={() => setMobileSheet(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
        </svg>
        {chips.length > 0 && <span className={styles.mobileFilterBadge}>{chips.length}</span>}
      </button>
      {!hideViewToggle && (
        <button className={styles.viewToggle} onClick={() => onViewModeChange(viewMode === 'map' ? 'list' : 'map')}
          title={viewMode === 'map' ? 'Показать списком' : 'Показать на карте'}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <div className={`${styles.viewTrack} ${viewMode === 'map' ? styles.viewTrackOn : ''}`}>
            <div className={styles.viewThumb} />
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
      )}
    </div>

    {/* ── Мобильные вкладки (если переданы tabs) ── */}
    {tabs && tabs.length > 0 && (
      <div className={styles.mobileTabsRow}>
        {tabs.map(t => (
          <button key={t.key}
            className={`${styles.mobileTab} ${activeTab === t.key ? styles.mobileTabActive : ''}`}
            onClick={() => onTabChange?.(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    )}

    {/* ── Десктоп: полный FilterBar ── */}
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
        {!hideViewToggle && (
          <button className={styles.viewToggle} onClick={() => onViewModeChange(viewMode === 'map' ? 'list' : 'map')}
            title={viewMode === 'map' ? 'Показать списком' : 'Показать на карте'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <div className={`${styles.viewTrack} ${viewMode === 'map' ? styles.viewTrackOn : ''}`}>
              <div className={styles.viewThumb} />
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
        )}
      </div>

      {/* ── Быстрые фильтры ── */}
      <div className={styles.quickRow}>
        {/* Город */}
        {!hideCity && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button ref={cityBtnRef} className={styles.cityBtn} onClick={() => setShowCity(v => !v)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {cityName || 'Мой город'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={showCity ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
            </button>
            {cityName && (
              <button className={styles.cityIconBtn} title="Сбросить город" onClick={restoreHomeCity}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        )}

        <div className={styles.sep}/>

        {/* Группа: когда */}
        <span className={styles.groupLabel}>Когда</span>
        <button className={`${styles.quickBtn} ${quickDate === 'today'    ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('today')}>Сегодня</button>
        <button className={`${styles.quickBtn} ${quickDate === 'tomorrow' ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('tomorrow')}>Завтра</button>
        <button className={`${styles.quickBtn} ${quickDate === 'weekend'  ? styles.quickBtnOn : ''}`} onClick={() => handleQuickDate('weekend')}>Выходные</button>

        <div className={styles.sep}/>

        {/* Группа: цена */}
        <span className={styles.groupLabel}>Цена</span>
        <button className={`${styles.quickBtn} ${filters.price === 0 ? styles.quickBtnOn : ''}`} onClick={() => filters.price === 0 ? setFilter('price', undefined) : setFilter('price', 0)}>Бесплатно</button>

        <div className={styles.sep}/>

        {/* Группа: типы */}
        <span className={styles.groupLabel}>Тип</span>
        {QUICK_TYPES.map(t => (
          <button key={t.id} title={t.name}
            className={`${styles.quickBtn} ${styles.quickBtnIcon} ${draftTypes.includes(t.id) ? styles.quickBtnOn : ''}`}
            onClick={() => toggleType(t.id)}>
            {t.ico
              ? <img src={icoToUrl(t.ico) ?? ''} alt={t.name} width={14} height={14} className="event-type-ico" style={{ objectFit: 'contain' }} />
              : <span style={{ fontSize: 12 }}>{t.name[0]}</span>}
          </button>
        ))}
        <button className={`${styles.quickBtn} ${(draftTypes.length > 0 || draftCats.length > 0) ? styles.quickBtnOn : ''}`}
          onClick={() => setPickerOpen(true)}>
          Ещё&nbsp;
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <div className={styles.sep}/>

        {/* Дополнительные фильтры */}
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
              onFocus={e => e.currentTarget.select()}
              onChange={e => setFilter('price', e.target.value !== '' ? Number(e.target.value) : undefined)} />
          </div>
          <div className={styles.epBlock} style={{ flex: '2 1 160px' }}>
            <span className={styles.epLabel}>Радиус: {radiusKm || 25} км</span>
            <input type="range" min={1} max={100} step={1}
              className={styles.epSlider}
              value={radiusKm || 25}
              onChange={e => {
                setFilter('locationRange', Number(e.target.value) * 1000);
                clearTimeout(radiusDebounce.current);
                radiusDebounce.current = setTimeout(() => onSearchRef.current(), 1200);
              }}
            />
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

    <MobileFilterSheet
      open={mobileSheet}
      onClose={() => setMobileSheet(false)}
      onApply={handleApply}
      onReset={handleReset}
      onResetCity={restoreHomeCity}
      filters={filters}
      setFilter={setFilter}
      cityName={cityName}
      setCityName={setCityName}
      quickDate={quickDate}
      setQuickDate={setQuickDate}
      draftTypes={draftTypes}
      setDraftTypes={setDraftTypes}
      draftCats={draftCats}
      setDraftCats={setDraftCats}
      allTypes={allTypes}
      pickerOpen={pickerOpen}
      setPickerOpen={setPickerOpen}
      chips={chips}
      handleCitySelect={handleCitySelect}
      handleQuickDate={handleQuickDate}
    />
    </>
  );
}
