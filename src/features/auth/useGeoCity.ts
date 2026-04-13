// features/auth/useGeoCity.ts
// Определяет геолокацию пользователя (по IP через ipapi.co) и
// предоставляет список популярных городов как fallback.

import { useState, useEffect } from 'react';

export interface ICity {
  name: string;
  lat: number;
  lng: number;
}

// Список популярных городов России как fallback
export const POPULAR_CITIES: ICity[] = [
  { name: 'Москва',          lat: 55.7558, lng: 37.6173 },
  { name: 'Санкт-Петербург', lat: 59.9311, lng: 30.3609 },
  { name: 'Новосибирск',     lat: 54.9884, lng: 82.9357 },
  { name: 'Екатеринбург',    lat: 56.8389, lng: 60.6057 },
  { name: 'Казань',          lat: 55.8304, lng: 49.0661 },
  { name: 'Нижний Новгород', lat: 56.2965, lng: 43.9361 },
  { name: 'Челябинск',       lat: 55.1644, lng: 61.4368 },
  { name: 'Самара',          lat: 53.2028, lng: 50.1408 },
  { name: 'Уфа',             lat: 54.7388, lng: 55.9721 },
  { name: 'Ростов-на-Дону',  lat: 47.2357, lng: 39.7015 },
  { name: 'Омск',            lat: 54.9885, lng: 73.3242 },
  { name: 'Красноярск',      lat: 56.0153, lng: 92.8932 },
  { name: 'Воронеж',         lat: 51.6683, lng: 39.1919 },
  { name: 'Пермь',           lat: 58.0092, lng: 56.2386 },
  { name: 'Волгоград',       lat: 48.7080, lng: 44.5133 },
  { name: 'Минск',           lat: 53.9045, lng: 27.5615 },
  { name: 'Алматы',          lat: 43.2551, lng: 76.9126 },
];

interface GeoResult {
  detectedCity: ICity | null;
  detectedCoords: { lat: number; lng: number } | null;
  loading: boolean;
}

export function useGeoCity(): GeoResult {
  const [detectedCity,   setDetectedCity]   = useState<ICity | null>(null);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    // 1. Пробуем браузерную геолокацию (самый точный способ)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setDetectedCoords({ lat, lng });
          // Находим ближайший город из списка
          const nearest = findNearestCity(lat, lng);
          setDetectedCity(nearest);
          setLoading(false);
        },
        () => {
          // Браузер отказал — пробуем определение по IP
          fetchByIp();
        },
        { timeout: 5000 }
      );
    } else {
      fetchByIp();
    }
  }, []);

  async function fetchByIp() {
    try {
      // Публичный бесплатный API без ключа
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
        setDetectedCoords({ lat, lng });
        setDetectedCity(findNearestCity(lat, lng));
      }
    } catch {
      // Не удалось определить — оставляем null
    } finally {
      setLoading(false);
    }
  }

  return { detectedCity, detectedCoords, loading };
}

function findNearestCity(lat: number, lng: number): ICity | null {
  if (!POPULAR_CITIES.length) return null;
  let nearest = POPULAR_CITIES[0];
  let minDist = dist(lat, lng, nearest.lat, nearest.lng);
  for (const city of POPULAR_CITIES) {
    const d = dist(lat, lng, city.lat, city.lng);
    if (d < minDist) { minDist = d; nearest = city; }
  }
  // Если расстояние до ближайшего города > 500 км — считаем что не определили
  return minDist < 5 ? nearest : null; // 5 градусов ≈ ~500 км
}

function dist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}
