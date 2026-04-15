// shared/lib/yandexMaps.ts
// Яндекс.Карты API 2.1 (стабильный, работает с ключом "JavaScript API")

const YMAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY ?? '';

let loadPromise: Promise<void> | null = null;

export function loadYandexMaps(): Promise<void> {
  if (loadPromise) return loadPromise;
  if ((window as any).ymaps?.ready && (window as any).ymaps._loaded) return Promise.resolve();

  if (!YMAPS_API_KEY) {
    return Promise.reject(new Error('VITE_YANDEX_MAPS_KEY не задан в .env.local'));
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    // API 2.1 — стабильная версия, работает с ключом "JavaScript API"
    script.src   = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_API_KEY}&lang=ru_RU&load=package.full`;
    script.async = true;

    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new Error('Таймаут загрузки Яндекс.Карт'));
    }, 15_000);

    script.onload = () => {
      clearTimeout(timer);
      const ymaps = (window as any).ymaps;
      if (!ymaps?.ready) {
        loadPromise = null;
        reject(new Error('ymaps не найден после загрузки'));
        return;
      }
      ymaps.ready(() => {
        ymaps._loaded = true;
        console.log('[YMaps] 2.1 успешно загружены');
        resolve();
      });
    };

    script.onerror = () => {
      clearTimeout(timer);
      loadPromise = null;
      reject(new Error(
        `Не удалось загрузить Яндекс.Карты. ` +
        `Ключ: ${YMAPS_API_KEY.slice(0, 8)}... — ` +
        `убедитесь что в настройках ключа активирован сервис "JavaScript API"`
      ));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface GeocodedPlace { lat: number; lng: number; address: string; }

export async function geocodeAddress(query: string): Promise<GeocodedPlace | null> {
  if (!query.trim() || !YMAPS_API_KEY) return null;
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${encodeURIComponent(query)}&format=json&results=1&lang=ru_RU`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!member) return null;
    const pos = member.Point?.pos?.split(' '); // "lng lat"
    if (!pos || pos.length < 2) return null;
    return {
      lng:     parseFloat(pos[0]),
      lat:     parseFloat(pos[1]),
      address: member.metaDataProperty?.GeocoderMetaData?.text ?? query,
    };
  } catch { return null; }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!YMAPS_API_KEY) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YMAPS_API_KEY}`
      + `&geocode=${lng},${lat}&format=json&results=1&lang=ru_RU`;
    const res  = await fetch(url);
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const json = await res.json();
    const member = json?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    return member?.metaDataProperty?.GeocoderMetaData?.text ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}
