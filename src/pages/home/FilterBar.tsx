// pages/home/FilterBar.tsx

import { useState, useRef, useEffect } from 'react';
import type { EventViewMode } from '@/entities/event';
import { useFiltersStore } from '@/app/store';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  searchName: string;
  onSearchChange: (v: string) => void;
  viewMode: EventViewMode;
  onViewModeChange: (v: EventViewMode) => void;
  /** Вызывается по кнопке «Искать» */
  onSearch: () => void;
}

export function FilterBar({
  searchName, onSearchChange, viewMode, onViewModeChange, onSearch,
}: FilterBarProps) {
  const [expanded, setExpanded]     = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { filters, setFilter, resetFilters } = useFiltersStore();
  const barRef = useRef<HTMLDivElement>(null);

  const selectedCategories = filters.categories ?? [];
  const selectedTypes      = filters.types      ?? [];
  const typeFilterCount    = selectedCategories.length + selectedTypes.length;
  const hasActiveFilters   = !!(filters.startTime || filters.endTime || typeFilterCount || filters.price);

  // Закрытие по Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const handleSearch = () => {
    setExpanded(false);
    onSearch();
  };

  return (
    <>
      {/* Backdrop фильтров — закрывает по клику вне */}
      {expanded && (
        <div className={styles.filterBackdrop} onClick={() => setExpanded(false)} aria-hidden />
      )}

      <div className={styles.bar} ref={barRef}>
        {/* ---- Главная строка: поиск + кнопки ---- */}
        <div className={styles.row}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Поиск мероприятий..."
              value={searchName}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            {searchName && (
              <button className={styles.clearBtn} onClick={() => onSearchChange('')}>✕</button>
            )}
          </div>

          {/* Кнопка фильтров */}
          <button
            className={`${styles.filterToggle} ${expanded || hasActiveFilters ? styles.filterActive : ''}`}
            onClick={() => setExpanded(v => !v)}
            aria-label="Фильтры"
            aria-expanded={expanded}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {hasActiveFilters && <span className={styles.filterDot}/>}
          </button>

          {/* Переключатель вид */}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'map'  ? styles.viewActive : ''}`}
              onClick={() => onViewModeChange('map')} title="Карта"
            >🗺️</button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewActive : ''}`}
              onClick={() => onViewModeChange('list')} title="Список"
            >☰</button>
          </div>
        </div>

        {/* ---- Dropdown фильтров — overlay, не сдвигает контент ---- */}
        {expanded && (
          <div className={styles.filtersDropdown}>
            {/* Тип мероприятия */}
            <div className={styles.filterGroupFull}>
              <label className={styles.filterLabel}>Тип мероприятия</label>
              <button
                className={`${styles.pickerBtn} ${typeFilterCount > 0 ? styles.pickerBtnActive : ''}`}
                onClick={() => setPickerOpen(true)}
              >
                {typeFilterCount > 0 ? `Выбрано: ${typeFilterCount}` : 'Все категории и типы'}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" style={{ marginLeft: 'auto' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>

            {/* Дата */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Дата от</label>
                <input type="datetime-local" className={styles.filterInput}
                  value={filters.startTime ? toLocalInput(filters.startTime) : ''}
                  onChange={e => setFilter('startTime', e.target.value
                    ? new Date(e.target.value).toISOString() : undefined)}/>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Дата до</label>
                <input type="datetime-local" className={styles.filterInput}
                  value={filters.endTime ? toLocalInput(filters.endTime) : ''}
                  onChange={e => setFilter('endTime', e.target.value
                    ? new Date(e.target.value).toISOString() : undefined)}/>
              </div>
            </div>

            {/* Цена и радиус */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Макс. цена, ₽</label>
                <input type="number" min={0} step={100} className={styles.filterInput}
                  placeholder="Любая" value={filters.price ?? ''}
                  onChange={e => setFilter('price', e.target.value ? Number(e.target.value) : undefined)}/>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Радиус, м</label>
                <input type="number" min={500} step={500} className={styles.filterInput}
                  placeholder="Весь город" value={filters.locationRange ?? ''}
                  onChange={e => setFilter('locationRange', e.target.value ? Number(e.target.value) : undefined)}/>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.filterActions}>
              {hasActiveFilters && (
                <button className={styles.resetBtn}
                  onClick={() => { resetFilters(); onSearchChange(''); }}>
                  Сбросить
                </button>
              )}
              <button className={styles.searchBtn} onClick={handleSearch}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Искать
              </button>
            </div>
          </div>
        )}
      </div>

      {pickerOpen && (
        <CategoryTypePicker
          selectedCategories={selectedCategories}
          selectedTypes={selectedTypes}
          onChange={(cats, types) => {
            setFilter('categories', cats.length ? cats : undefined);
            setFilter('types',      types.length ? types : undefined);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
