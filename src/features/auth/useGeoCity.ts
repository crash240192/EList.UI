// features/auth/useGeoCity.ts
// Определяет геолокацию пользователя (по IP через ipapi.co) и
// предоставляет список популярных городов как fallback.

import { useState, useEffect } from 'react';

export interface ICity {
  name: string;      // полное название — для отображения в списке
  shortName?: string; // короткое — только город, для поля после выбора
  lat: number;
  lng: number;
}

// Список популярных городов России как fallback
export const POPULAR_CITIES: ICity[] = [
  // Россия — крупнейшие города
  { name: 'Москва',              lat: 55.7558, lng: 37.6173 },
  { name: 'Санкт-Петербург',    lat: 59.9311, lng: 30.3609 },
  { name: 'Новосибирск',        lat: 54.9884, lng: 82.9357 },
  { name: 'Екатеринбург',       lat: 56.8389, lng: 60.6057 },
  { name: 'Казань',             lat: 55.8304, lng: 49.0661 },
  { name: 'Нижний Новгород',    lat: 56.2965, lng: 43.9361 },
  { name: 'Челябинск',          lat: 55.1644, lng: 61.4368 },
  { name: 'Самара',             lat: 53.2028, lng: 50.1408 },
  { name: 'Уфа',                lat: 54.7388, lng: 55.9721 },
  { name: 'Ростов-на-Дону',     lat: 47.2357, lng: 39.7015 },
  { name: 'Омск',               lat: 54.9885, lng: 73.3242 },
  { name: 'Красноярск',         lat: 56.0153, lng: 92.8932 },
  { name: 'Воронеж',            lat: 51.6683, lng: 39.1919 },
  { name: 'Пермь',              lat: 58.0092, lng: 56.2386 },
  { name: 'Волгоград',          lat: 48.7080, lng: 44.5133 },
  { name: 'Краснодар',          lat: 45.0355, lng: 38.9753 },
  { name: 'Саратов',            lat: 51.5336, lng: 46.0343 },
  { name: 'Тюмень',             lat: 57.1522, lng: 65.5272 },
  { name: 'Тольятти',           lat: 53.5110, lng: 49.4196 },
  { name: 'Ижевск',             lat: 56.8526, lng: 53.2068 },
  { name: 'Барнаул',            lat: 53.3606, lng: 83.7636 },
  { name: 'Ульяновск',          lat: 54.3283, lng: 48.3871 },
  { name: 'Иркутск',            lat: 52.2978, lng: 104.2964 },
  { name: 'Хабаровск',          lat: 48.4827, lng: 135.0840 },
  { name: 'Владивосток',        lat: 43.1056, lng: 131.8735 },
  { name: 'Ярославль',          lat: 57.6261, lng: 39.8845 },
  { name: 'Махачкала',          lat: 42.9849, lng: 47.5047 },
  { name: 'Томск',              lat: 56.4846, lng: 84.9481 },
  { name: 'Оренбург',           lat: 51.7677, lng: 55.0988 },
  { name: 'Кемерово',           lat: 55.3909, lng: 86.0875 },
  { name: 'Новокузнецк',        lat: 53.7557, lng: 87.1099 },
  { name: 'Рязань',             lat: 54.6269, lng: 39.6916 },
  { name: 'Астрахань',          lat: 46.3497, lng: 48.0408 },
  { name: 'Набережные Челны',   lat: 55.7440, lng: 52.3961 },
  { name: 'Пенза',              lat: 53.2007, lng: 44.9984 },
  { name: 'Липецк',             lat: 52.6031, lng: 39.5708 },
  { name: 'Киров',              lat: 58.6035, lng: 49.6682 },
  { name: 'Чебоксары',          lat: 56.1439, lng: 47.2489 },
  { name: 'Тула',               lat: 54.1961, lng: 37.6182 },
  { name: 'Калининград',        lat: 54.7104, lng: 20.4522 },
  { name: 'Курск',              lat: 51.7373, lng: 36.1873 },
  { name: 'Брянск',             lat: 53.2434, lng: 34.3634 },
  { name: 'Иваново',            lat: 57.0005, lng: 40.9739 },
  { name: 'Магнитогорск',       lat: 53.4087, lng: 59.0628 },
  { name: 'Улан-Удэ',          lat: 51.8277, lng: 107.6060 },
  { name: 'Тверь',              lat: 56.8587, lng: 35.9176 },
  { name: 'Нижний Тагил',       lat: 57.9197, lng: 59.9704 },
  { name: 'Ставрополь',         lat: 45.0448, lng: 41.9694 },
  { name: 'Белгород',           lat: 50.5997, lng: 36.5858 },
  { name: 'Архангельск',        lat: 64.5401, lng: 40.5433 },
  { name: 'Владимир',           lat: 56.1291, lng: 40.4076 },
  { name: 'Чита',               lat: 52.0336, lng: 113.5007 },
  { name: 'Калуга',             lat: 54.5293, lng: 36.2754 },
  { name: 'Смоленск',           lat: 54.7818, lng: 32.0401 },
  { name: 'Волжский',           lat: 48.7897, lng: 44.7506 },
  { name: 'Сочи',               lat: 43.5992, lng: 39.7257 },
  { name: 'Якутск',             lat: 62.0355, lng: 129.6755 },
  { name: 'Мурманск',           lat: 68.9585, lng: 33.0827 },
  { name: 'Сургут',             lat: 61.2540, lng: 73.3963 },
  { name: 'Вологда',            lat: 59.2181, lng: 39.8739 },
  { name: 'Орёл',               lat: 52.9651, lng: 36.0785 },
  { name: 'Тамбов',             lat: 52.7212, lng: 41.4523 },
  { name: 'Сыктывкар',          lat: 61.6688, lng: 50.8364 },
  { name: 'Грозный',            lat: 43.3177, lng: 45.6985 },
  { name: 'Чебоксары',          lat: 56.1439, lng: 47.2489 },
  // СНГ
  { name: 'Минск',              lat: 53.9045, lng: 27.5615 },
  { name: 'Алматы',             lat: 43.2551, lng: 76.9126 },
  { name: 'Астана',             lat: 51.1801, lng: 71.4460 },
  { name: 'Киев',               lat: 50.4501, lng: 30.5234 },
  { name: 'Ташкент',            lat: 41.2995, lng: 69.2401 },
  { name: 'Баку',               lat: 40.4093, lng: 49.8671 },
  { name: 'Тбилиси',            lat: 41.6938, lng: 44.8015 },
  { name: 'Ереван',             lat: 40.1872, lng: 44.5152 },
  { name: 'Бишкек',             lat: 42.8746, lng: 74.5698 },
  { name: 'Кишинёв',            lat: 47.0105, lng: 28.8638 },
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
