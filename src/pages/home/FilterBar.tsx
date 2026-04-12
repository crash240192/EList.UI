// pages/home/FilterBar.tsx

import { useState } from 'react';
import type { EventViewMode } from '@/entities/event';
import { useFiltersStore } from '@/app/store';
import { CategoryTypePicker } from '@/features/event-filters/CategoryTypePicker';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  searchName: string;
  onSearchChange: (v: string) => void;
  viewMode: EventViewMode;
  onViewModeChange: (v: EventViewMode) => void;
}

export function FilterBar({ searchName, onSearchChange, viewMode, onViewModeChange }: FilterBarProps) {
  const [expanded, setExpanded]     = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { filters, setFilter, resetFilters } = useFiltersStore();

  const selectedCategories = filters.categories ?? [];
  const selectedTypes      = filters.types ?? [];
  const typeFilterCount    = selectedCategories.length + selectedTypes.length;

  const hasActiveFilters =
    filters.startTime || filters.endTime || typeFilterCount > 0 || filters.price;

  return (
    <div className={styles.bar}>
      {/* ---- Row 1: search + toggles ---- */}
      <div className={styles.row}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Поиск мероприятий..."
            value={searchName}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchName && (
            <button className={styles.clearBtn} onClick={() => onSearchChange('')} aria-label="Очистить">✕</button>
          )}
        </div>

        <button
          className={`${styles.filterToggle} ${hasActiveFilters ? styles.filterActive : ''}`}
          onClick={() => setExpanded(v => !v)}
          aria-label="Фильтры"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {hasActiveFilters && <span className={styles.filterDot} />}
        </button>

        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${viewMode === 'map'  ? styles.viewActive : ''}`} onClick={() => onViewModeChange('map')}  title="Карта">🗺️</button>
          <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewActive : ''}`} onClick={() => onViewModeChange('list')} title="Список">☰</button>
        </div>
      </div>

      {/* ---- Row 2: expanded filters ---- */}
      {expanded && (
        <div className={styles.filters}>

          {/* Поиск по названию */}
          <div className={styles.filterGroupFull}>
            <label className={styles.filterLabel}>Название</label>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className={styles.filterInput}
                style={{ paddingLeft: 30 }}
                placeholder="Поиск по названию..."
                value={searchName}
                onChange={e => onSearchChange(e.target.value)}
              />
              {searchName && (
                <button className={styles.clearBtn} onClick={() => onSearchChange('')}>✕</button>
              )}
            </div>
          </div>

          {/* Тип мероприятия — кнопка пикера */}
          <div className={styles.filterGroupFull}>
            <label className={styles.filterLabel}>Тип мероприятия</label>
            <button
              className={`${styles.pickerBtn} ${typeFilterCount > 0 ? styles.pickerBtnActive : ''}`}
              onClick={() => setPickerOpen(true)}
            >
              {typeFilterCount > 0
                ? `Выбрано: ${typeFilterCount}`
                : 'Все категории и типы'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Дата */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Дата от</label>
            <input
              type="datetime-local"
              className={styles.filterInput}
              value={filters.startTime ? toLocalInput(filters.startTime) : ''}
              onChange={e => setFilter('startTime', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Дата до</label>
            <input
              type="datetime-local"
              className={styles.filterInput}
              value={filters.endTime ? toLocalInput(filters.endTime) : ''}
              onChange={e => setFilter('endTime', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>

          {/* Цена и радиус */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Макс. цена</label>
            <input
              type="number" min={0} step={100}
              className={styles.filterInput}
              placeholder="Любая"
              value={filters.price ?? ''}
              onChange={e => setFilter('price', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Радиус (м)</label>
            <input
              type="number" min={500} step={500}
              className={styles.filterInput}
              placeholder="Весь город"
              value={filters.locationRange ?? ''}
              onChange={e => setFilter('locationRange', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          {hasActiveFilters && (
            <button className={styles.resetBtn} onClick={() => { resetFilters(); onSearchChange(''); }}>
              Сбросить всё
            </button>
          )}
        </div>
      )}

      {/* ---- CategoryTypePicker modal ---- */}
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
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
