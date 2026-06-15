// features/event-map/YandexMapPicker.tsx — единое поле адреса + карта с темой

import { useState, useCallback } from 'react';
import { geocodeAddress } from '@/shared/lib/yandexMaps';
import { PickerMapView } from './PickerMapView';
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
        <button className={styles.searchBtn} type="button" onClick={handleGeocode} disabled={geocoding}>
          {geocoding ? '⏳' : '🔍'}
        </button>
      </div>
      <div className={styles.pickerMapWrap}>
        <button
          type="button"
          className={styles.pickerExpandBtn}
          onClick={() => setMapExpanded(true)}
          aria-label="Развернуть карту"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          </svg>
          Развернуть
        </button>
        <PickerMapView
          lat={lat}
          lng={lng}
          address={address}
          initialCenter={initialCenter}
          onPick={onPick}
          onAddressChange={onAddressChange}
          onGeocodingChange={setGeocoding}
        />
      </div>
      <p className={styles.hint}>Кликните по карте или перетащите маркер — адрес определится автоматически</p>

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
