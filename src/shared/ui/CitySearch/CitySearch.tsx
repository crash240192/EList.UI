// shared/ui/CitySearch/CitySearch.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef     = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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
      setOpen(items.length > 0);
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 350);
  };

  const handleSelect = (city: ICity) => {
    setQuery(city.shortName ?? city.name);
    setSuggestions([]);
    setOpen(false);
    onSelect(city);
  };

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={e => { e.target.select(); if (suggestions.length > 0) setOpen(true); }}
          autoComplete="off"
        />
        {(geoLoading || searching) && <span className={styles.spinner}>📡</span>}
        {!geoLoading && !searching && detectedCoords && query && <span className={styles.ok}>✓</span>}
        {onAutoDetect && (
          <button type="button" className={styles.autoBtn} onClick={onAutoDetect}
            disabled={geoLoading} title="Определить автоматически">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
            </svg>
            <span className={styles.autoBtnText}>Определить</span>
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className={styles.dropdown}>
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
        </div>
      )}
    </div>
  );
}
