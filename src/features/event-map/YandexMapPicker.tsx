// features/event-map/YandexMapPicker.tsx — единое поле адреса + карта с темой

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadYandexMaps, geocodeAddress, reverseGeocode } from '@/shared/lib/yandexMaps';
import { useThemeStore } from '@/app/store';
import styles from './YandexMap.module.css';

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
  hasError?: boolean;
  onPick: (lat: number, lng: number, address: string) => void;
  onAddressChange: (address: string) => void;
}

export function YandexMapPicker({ lat, lng, address, hasError, onPick, onAddressChange }: Props) {
  const ref       = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loadErr,   setLoadErr]   = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [ready,     setReady]     = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    let destroyed = false;
    loadYandexMaps().then(() => {
      if (destroyed || !ref.current) return;
      const ymaps = (window as any).ymaps;
      const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [55.7558, 37.6173];

      const map = new ymaps.Map(ref.current, {
        center, zoom: lat !== null ? 15 : 10,
        controls: ['zoomControl'],
        type: 'yandex#map',
      });

      async function placeOrMove(coords: [number, number], doGeocode: boolean) {
        if (markerRef.current) {
          markerRef.current.geometry.setCoordinates(coords);
        } else {
          const pm = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#redDotIcon' });
          pm.events.add('dragend', async () => {
            const c = pm.geometry.getCoordinates() as [number, number];
            setGeocoding(true);
            const a = await reverseGeocode(c[0], c[1]);
            setGeocoding(false);
            onAddressChange(a);
            onPick(c[0], c[1], a);
          });
          map.geoObjects.add(pm);
          markerRef.current = pm;
        }
        map.setCenter(coords, 15, { duration: 300 });
        if (doGeocode) {
          setGeocoding(true);
          const a = await reverseGeocode(coords[0], coords[1]);
          setGeocoding(false);
          onAddressChange(a);
          onPick(coords[0], coords[1], a);
        } else {
          onPick(coords[0], coords[1], address);
        }
      }

      if (lat !== null && lng !== null) placeOrMove([lat, lng], false);

      map.events.add('click', (e: any) => placeOrMove(e.get('coords') as [number, number], true));

      mapRef.current = map;
      setReady(true);
    }).catch(e => setLoadErr(e.message));
    return () => { destroyed = true; mapRef.current?.destroy?.(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Внешнее обновление координат
  useEffect(() => {
    if (!ready || !mapRef.current || lat === null || lng === null) return;
    const ymaps = (window as any).ymaps;
    if (markerRef.current) {
      markerRef.current.geometry.setCoordinates([lat, lng]);
    } else {
      const pm = new ymaps.Placemark([lat, lng], {}, { draggable: true, preset: 'islands#redDotIcon' });
      pm.events.add('dragend', async () => {
        const c = pm.geometry.getCoordinates() as [number, number];
        setGeocoding(true);
        const a = await reverseGeocode(c[0], c[1]);
        setGeocoding(false);
        onAddressChange(a);
        onPick(c[0], c[1], a);
      });
      mapRef.current.geoObjects.add(pm);
      markerRef.current = pm;
    }
    mapRef.current.setCenter([lat, lng], 15, { duration: 300 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

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

  if (loadErr) return <div className={styles.errorBox}>⚠️ {loadErr}</div>;

  const darkFilter = 'invert(0.9) hue-rotate(180deg) saturate(0.75) brightness(0.9)';

  return (
    <div className={`${styles.pickerWrap} ${hasError ? styles.pickerWrapError : ''}`}>
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Введите адрес и нажмите Enter или кликните по карте"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
        />
        <button className={styles.searchBtn} type="button" onClick={handleGeocode} disabled={geocoding}>
          {geocoding ? '⏳' : '🔍'}
        </button>
      </div>
      <div
        ref={ref}
        className={styles.pickerMap}
        style={theme === 'dark' ? { filter: darkFilter } : undefined}
      />
      <p className={styles.hint}>Кликните по карте или перетащите маркер — адрес определится автоматически</p>
    </div>
  );
}
