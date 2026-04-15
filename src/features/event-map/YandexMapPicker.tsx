// features/event-map/YandexMapPicker.tsx — пикер координат (API 2.1)

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadYandexMaps, geocodeAddress, reverseGeocode } from '@/shared/lib/yandexMaps';
import styles from './YandexMap.module.css';

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
  hasError?: boolean;
  onPick: (lat: number, lng: number, address: string) => void;
}

export function YandexMapPicker({ lat, lng, address, hasError, onPick }: Props) {
  const ref       = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loadErr,   setLoadErr]   = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [search,    setSearch]    = useState(address);
  const [ready,     setReady]     = useState(false);

  // Инициализация карты
  useEffect(() => {
    let destroyed = false;
    loadYandexMaps()
      .then(() => {
        if (destroyed || !ref.current) return;
        const ymaps = (window as any).ymaps;

        const center: [number, number] = lat !== null && lng !== null
          ? [lat, lng] : [55.7558, 37.6173];

        const map = new ymaps.Map(ref.current, {
          center,
          zoom: lat !== null ? 15 : 10,
          controls: ['zoomControl', 'searchControl'],
        });

        // Если уже есть координаты — ставим маркер
        if (lat !== null && lng !== null) {
          const pm = new ymaps.Placemark([lat, lng], {}, { draggable: true, preset: 'islands#redDotIcon' });
          map.geoObjects.add(pm);
          markerRef.current = pm;
          // Перетаскивание маркера
          pm.events.add('dragend', async () => {
            const coords = pm.geometry.getCoordinates();
            setGeocoding(true);
            const addr = await reverseGeocode(coords[0], coords[1]);
            setGeocoding(false);
            setSearch(addr);
            onPick(coords[0], coords[1], addr);
          });
        }

        // Клик по карте — ставим/переставляем маркер
        map.events.add('click', async (e: any) => {
          const coords: [number, number] = e.get('coords');

          if (markerRef.current) {
            markerRef.current.geometry.setCoordinates(coords);
          } else {
            const pm = new ymaps.Placemark(coords, {}, { draggable: true, preset: 'islands#redDotIcon' });
            map.geoObjects.add(pm);
            markerRef.current = pm;
            pm.events.add('dragend', async () => {
              const c = pm.geometry.getCoordinates();
              setGeocoding(true);
              const a = await reverseGeocode(c[0], c[1]);
              setGeocoding(false);
              setSearch(a);
              onPick(c[0], c[1], a);
            });
          }

          setGeocoding(true);
          const addr = await reverseGeocode(coords[0], coords[1]);
          setGeocoding(false);
          setSearch(addr);
          onPick(coords[0], coords[1], addr);
        });

        mapRef.current = map;
        setReady(true);
      })
      .catch(e => setLoadErr(e.message));

    return () => {
      destroyed = true;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Обновляем маркер при внешнем изменении координат
  useEffect(() => {
    if (!ready || !mapRef.current || lat === null || lng === null) return;
    const ymaps = (window as any).ymaps;
    if (markerRef.current) {
      markerRef.current.geometry.setCoordinates([lat, lng]);
    } else {
      const pm = new ymaps.Placemark([lat, lng], {}, { draggable: true, preset: 'islands#redDotIcon' });
      mapRef.current.geoObjects.add(pm);
      markerRef.current = pm;
    }
    mapRef.current.setCenter([lat, lng], 15, { duration: 300 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, ready]);

  const handleGeocode = useCallback(async () => {
    if (!search.trim()) return;
    setGeocoding(true);
    const result = await geocodeAddress(search);
    setGeocoding(false);
    if (result) {
      setSearch(result.address);
      onPick(result.lat, result.lng, result.address);
    }
  }, [search, onPick]);

  if (loadErr) return <div className={styles.errorBox}>⚠️ {loadErr}</div>;

  return (
    <div className={`${styles.pickerWrap} ${hasError ? styles.pickerWrapError : ''}`}>
      <div className={styles.searchRow}>
        <input className={styles.searchInput}
          placeholder="Введите адрес для поиска..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
        />
        <button className={styles.searchBtn} type="button"
          onClick={handleGeocode} disabled={geocoding}>
          {geocoding ? '⏳' : '🔍'}
        </button>
      </div>
      <div ref={ref} className={styles.pickerMap} />
      <p className={styles.hint}>Кликните по карте или перетащите маркер для уточнения точки</p>
    </div>
  );
}
