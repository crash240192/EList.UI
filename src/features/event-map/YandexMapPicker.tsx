// features/event-map/YandexMapPicker.tsx — единое поле адреса + карта с темой

import { useState, useCallback } from 'react';
import { geocodeAddress } from '@/shared/lib/yandexMaps';
import { MapPickerModal } from './MapPickerModal';
import styles from './YandexMap.module.css';

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
  hasError?: boolean;
  /** Начальный центр если lat/lng ещё не выбраны */
  initialCenter?: [number, number];
  onPick: (lat: number, lng: number, address: string) => void;
  onAddressChange: (address: string) => void;
}

export function YandexMapPicker({ lat, lng, address, hasError, initialCenter, onPick, onAddressChange }: Props) {
  const [geocoding, setGeocoding] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const handleGeocode = useCallback(async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    const result = await geocodeAddress(address);
    setGeocoding(false);
    if (result) {
      onAddressChange(result.address);
      onPick(result.lat, result.lng, result.address);
    }
  }, [address, onPick, onAddressChange]);

  const hasPoint = lat !== null && lng !== null;
  const previewLabel = address.trim()
    || (hasPoint ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}` : 'Точка на карте ещё не выбрана');

  return (
    <div className={`${styles.pickerWrap} ${hasError ? styles.pickerWrapError : ''}`}>
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Введите адрес и нажмите Enter или кликните по карте"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          onFocus={e => e.target.select()}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
        />
        <button className={styles.searchBtn} type="button" onClick={handleGeocode} disabled={geocoding} aria-label="Найти адрес">
          {geocoding ? (
            <span className={styles.searchSpinner} aria-hidden />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
          )}
        </button>
      </div>
      <button
        type="button"
        className={styles.pickerMapWrap}
        onClick={() => setMapExpanded(true)}
        aria-label="Открыть карту для выбора точки"
      >
        <div className={`${styles.pickerMap} ${styles.pickerMapPreview} ${styles.pickerMapStatic}`}>
          <span className={styles.pickerMapStaticPin} aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <span className={styles.pickerMapStaticText}>{previewLabel}</span>
          <span className={styles.pickerMapStaticCta}>Открыть карту</span>
        </div>
      </button>
      <p className={styles.hint}>Нажмите, чтобы открыть карту и выбрать точку</p>

      {mapExpanded && (
        <MapPickerModal
          lat={lat}
          lng={lng}
          address={address}
          initialCenter={initialCenter}
          onPick={onPick}
          onAddressChange={onAddressChange}
          onClose={() => setMapExpanded(false)}
        />
      )}
    </div>
  );
}
