// features/event-map/MapPickerModal.tsx — развёрнутая карта для выбора точки

import { useEffect, useState } from 'react';
import { PickerMapView } from './PickerMapView';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './EventMapModal.module.css';

interface MapPickerModalProps {
  lat: number | null;
  lng: number | null;
  address: string;
  initialCenter?: [number, number];
  onPick: (lat: number, lng: number, address: string) => void;
  onAddressChange: (address: string) => void;
  onClose: () => void;
}

export function MapPickerModal({
  lat,
  lng,
  address,
  initialCenter,
  onPick,
  onAddressChange,
  onClose,
}: MapPickerModalProps) {
  const [geocoding, setGeocoding] = useState(false);

  useModalBackButton(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Выбор точки на карте">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Укажите точку на карте</h2>
            {address ? (
              <p className={styles.address}>{geocoding ? 'Определяем адрес…' : address}</p>
            ) : (
              <p className={styles.address}>
                {geocoding ? 'Определяем адрес…' : 'Зажмите и перетащите карту · Клик — выбрать точку'}
              </p>
            )}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.mapWrap}>
          <PickerMapView
            lat={lat}
            lng={lng}
            address={address}
            initialCenter={initialCenter}
            panEnabled
            className={styles.mapFill}
            onPick={onPick}
            onAddressChange={onAddressChange}
            onGeocodingChange={setGeocoding}
          />
        </div>
      </div>
    </>
  );
}
