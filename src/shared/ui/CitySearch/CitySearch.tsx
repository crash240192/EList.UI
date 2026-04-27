// shared/ui/CitySearch/CitySearch.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ICity } from '@/features/auth/useGeoCity';
import { loadYandexMaps } from '@/shared/lib/yandexMaps';
import styles from './CitySearch.module.css';

interface CitySearchProps {
  value: string;
  onSelect: (city: ICity) => void;
  geoLoading?: boolean;
  detectedCoords?: { lat: number; lng: number } | null;
  onAutoDetect?: () => void;
  placeholder?: string;
  className?: string;
}

export function CitySearch({
  value, onSelect, geoLoading, detectedCoords,
  onAutoDetect, placeholder = 'Начните вводить название города...',
  className,
}: CitySearchProps) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<ICity[]>([]);
  const [open,        setOpen]        = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [dropStyle,   setDropStyle]   = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const prevValueRef = useRef(value);
  useEffect(() => {
    // Синхронизируем query только если value изменился снаружи (не из нашего handleSelect)
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setQuery(value);
    }
  }, [value]);

  // Вычисляем позицию дропдауна под полем ввода
  const updateDropPos = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropStyle({
      position: 'fixed',
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 9999,
    });
  }, []);

  // Закрытие по клику вне
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const drop = document.querySelector('[data-citysearch-drop]');
      if (
        wrapRef.current?.contains(e.target as Node) ||
        drop?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    try {
      await loadYandexMaps();
      const ymaps = (window as any).ymaps;
      const res = await ymaps.geocode(q, {
        results: 8, lang: 'ru_RU',
        boundedBy: [[41.0, 19.0], [81.0, 180.0]],
        strictBounds: false,
      });
      const items: ICity[] = [];
      res.geoObjects.each((obj: any) => {
        const kind = obj.properties?.get('metaDataProperty.GeocoderMetaData.kind');
        if (kind && !['locality', 'province', 'area'].includes(kind)) return;
        const coords = obj.geometry.getCoordinates();
        if (!coords) return;
        const meta = obj.properties?.get('metaDataProperty.GeocoderMetaData.Address.Components') as any[] | undefined;
        let city = ''; let region = ''; let country = '';
        if (meta) for (const c of meta) {
          if (c.kind === 'locality') city = c.name;
          else if (c.kind === 'area' || c.kind === 'province') region = c.name;
          else if (c.kind === 'country') country = c.name;
        }
        const name = city || obj.getAddressLine?.() || q;
        const suffix = country && country !== 'Россия' ? `, ${country}` : region ? `, ${region}` : '';
        items.push({ name: name + suffix, shortName: name, lat: coords[0], lng: coords[1] });
      });
      setSuggestions(items);
      if (items.length > 0) { updateDropPos(); setOpen(true); }
      else setOpen(false);
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, [updateDropPos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 350);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Выделяем текст при фокусе — через setTimeout чтобы не конфликтовать с кликом
    const target = e.target;
    setTimeout(() => target.select(), 0);
    if (suggestions.length > 0) { updateDropPos(); setOpen(true); }
  };

  const handleSelect = (city: ICity) => {
    const name = city.shortName ?? city.name;
    setQuery(name);
    prevValueRef.current = name;
    setSuggestions([]);
    setOpen(false);
    onSelect(city);
  };

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {searching && <span className={styles.spinner}>📡</span>}
        {!searching && detectedCoords && query && <span className={styles.ok}>✓</span>}
        {onAutoDetect && (
          <button type="button" className={styles.autoBtn} onClick={onAutoDetect}
            title="Определить автоматически">
            {geoLoading
              ? <span className={styles.spinner}>📡</span>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
                </svg>
            }
            <span className={styles.autoBtnText}>Определить</span>
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && createPortal(
        <div data-citysearch-drop style={dropStyle} className={styles.dropdown}>
          {suggestions.map((c, i) => (
            <button key={i} className={styles.item}
              onMouseDown={e => { e.preventDefault(); handleSelect(c); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {c.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
