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
      <button
        type="button"
        className={styles.pickerMapWrap}
        onClick={() => setMapExpanded(true)}
        aria-label="Открыть карту для выбора точки"
      >
        <PickerMapView
          lat={lat}
          lng={lng}
          address={address}
          initialCenter={initialCenter}
          onPick={onPick}
          onAddressChange={onAddressChange}
          onGeocodingChange={setGeocoding}
          className={styles.pickerMapPreview}
        />
      </button>
      <p className={styles.hint}>Нажмите на карту, чтобы выбрать точку в полноэкранном режиме</p>

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
