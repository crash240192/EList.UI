// features/event-map/EventMapModal.tsx — увеличенная карта мероприятия

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { YandexMap } from './YandexMap';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './EventMapModal.module.css';

interface EventMapModalProps {
  lat: number;
  lng: number;
  label?: string;
  address?: string | null;
  onClose: () => void;
}

export function EventMapModal({ lat, lng, label, address, onClose }: EventMapModalProps) {
  useModalBackButton(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Карта места проведения">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Место проведения</h2>
            {address && <p className={styles.address}>{address}</p>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.mapWrap}>
          <YandexMap lat={lat} lng={lng} label={label} zoom={15} draggable />
        </div>
      </div>
    </>,
    document.body,
  );
}
