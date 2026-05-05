// features/auth/useUserLocation.ts

import { useState, useEffect } from 'react';
import { updateLocation } from '@/entities/user/settingsApi';
import { cookies } from '@/shared/lib/cookies';
import { apiClient } from '@/shared/api/client';
import { isAuthenticated } from '@/shared/api/client';

const COOKIE_LAT          = 'elist_user_lat';      // выбранные координаты для карты
const COOKIE_LNG          = 'elist_user_lng';
const COOKIE_ACCOUNT_LAT  = 'elist_acct_lat';      // последние известные координаты аккаунта
const COOKIE_ACCOUNT_LNG  = 'elist_acct_lng';
const COOKIE_DECISION_DONE = 'elist_city_decided'; // "1" — пользователь уже ответил на диалог

export interface UserCoords { lat: number; lng: number; }
const MOSCOW: UserCoords = { lat: 55.7558, lng: 37.6173 };
const CITY_CHANGE_THRESHOLD_KM = 200;
// Если аккаунтные координаты изменились более чем на N км — сбрасываем решение
const ACCOUNT_CHANGE_THRESHOLD_KM = 50;

function haversineKm(a: UserCoords, b: UserCoords): number {
  const R  = 6371;
  const dL = ((b.lat - a.lat) * Math.PI) / 180;
  const dN = ((b.lng - a.lng) * Math.PI) / 180;
  const x  = Math.sin(dL / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180)
    * Math.cos((b.lat * Math.PI) / 180)
    * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function readCookieCoords(latKey: string, lngKey: string): UserCoords | null {
  const la = cookies.get(latKey), lo = cookies.get(lngKey);
  if (!la || !lo) return null;
  const lat = parseFloat(la), lng = parseFloat(lo);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}

function writeCookieCoords(latKey: string, lngKey: string, c: UserCoords): void {
  cookies.set(latKey, String(c.lat), 30);
  cookies.set(lngKey, String(c.lng), 30);
}

function storeUserCoords(c: UserCoords)    { writeCookieCoords(COOKIE_LAT, COOKIE_LNG, c); }
function readUserCoords()                  { return readCookieCoords(COOKIE_LAT, COOKIE_LNG); }
function storeAccountCoords(c: UserCoords) { writeCookieCoords(COOKIE_ACCOUNT_LAT, COOKIE_ACCOUNT_LNG, c); }
function readAccountCoords()               { return readCookieCoords(COOKIE_ACCOUNT_LAT, COOKIE_ACCOUNT_LNG); }
function markDecisionDone()                { cookies.set(COOKIE_DECISION_DONE, '1', 30); }
export function clearCityDecision() { cookies.delete(COOKIE_DECISION_DONE); }
function isDecisionDone()                  { return cookies.get(COOKIE_DECISION_DONE) === '1'; }

async function detectCurrentCoords(): Promise<UserCoords | null> {
  const byBrowser = await new Promise<UserCoords | null>(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
  if (byBrowser) return byBrowser;

  try {
    const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.latitude && d.longitude)
      return { lat: parseFloat(d.latitude), lng: parseFloat(d.longitude) };
  } catch {}
  return null;
}

async function getCityName(c: UserCoords): Promise<string> {
  const key = import.meta.env.VITE_YANDEX_MAPS_KEY;
  if (!key) return `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`;
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${key}`
      + `&geocode=${c.lng},${c.lat}&format=json&results=1&lang=ru_RU&kind=locality`;
    const j = await (await fetch(url)).json();
    return j?.response?.GeoObjectCollection?.featureMember?.[0]
      ?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text
      ?? `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`;
  } catch { return `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`; }
}

export interface UseUserLocationResult {
  coords:          UserCoords;
  showCityConfirm: boolean;
  detectedCity:    string;
  confirmCity:     () => void;
  keepOldCity:     () => void;
  triggerCityCheck: () => void;
}

export function useUserLocation(): UseUserLocationResult {
  const [coords,          setCoords]          = useState<UserCoords>(readUserCoords() ?? MOSCOW);
  const [showCityConfirm, setShowCityConfirm] = useState(false);
  const [detectedCity,    setDetectedCity]    = useState('');
  const [pendingCoords,   setPendingCoords]   = useState<UserCoords | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Получаем координаты аккаунта
      let accountCoords: UserCoords | null = null;
      if (isAuthenticated()) {
        try {
          const r = await apiClient.get<any>('/api/accounts/getData');
          const d = r.result;
          const lat = Number(d?.latitude);
          const lng = Number(d?.longitude);
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            accountCoords = { lat, lng };
          }
        } catch {}
      }
      if (cancelled) return;

      if (!accountCoords) {
        // Нет координат в аккаунте — используем cookies или IP
        const cached = readUserCoords();
        if (cached) { setCoords(cached); return; }
        const detected = await detectCurrentCoords();
        if (cancelled) return;
        const fallback = detected ?? MOSCOW;
        setCoords(fallback);
        storeUserCoords(fallback);
        return;
      }

      // 2. Есть координаты аккаунта
      //    Проверяем, менялись ли они с прошлого раза
      const prevAccountCoords = readAccountCoords();
      const accountChanged = !prevAccountCoords
        || haversineKm(prevAccountCoords, accountCoords) > ACCOUNT_CHANGE_THRESHOLD_KM;

      if (accountChanged) {
        // Координаты аккаунта изменились → сбрасываем старое решение пользователя
        clearCityDecision();
        storeAccountCoords(accountCoords);
        // Ставим координаты аккаунта как текущие
        setCoords(accountCoords);
        storeUserCoords(accountCoords);
      } else {
        // Координаты аккаунта те же — используем то что пользователь выбрал ранее
        const userChosen = readUserCoords();
        if (userChosen) {
          setCoords(userChosen);
        } else {
          setCoords(accountCoords);
          storeUserCoords(accountCoords);
        }
      }

      // Если название родного города ещё не записано (или координаты сменились) —
      // геокодируем и сохраняем, затем обновляем FilterBar через событие
      const existingHomeName = cookies.get('elist_home_city_name');
      if (!existingHomeName || accountChanged) {
        getCityName(accountCoords).then(name => {
          if (cancelled || !name) return;
          cookies.set('elist_home_city_name', name, 30);
          window.dispatchEvent(new CustomEvent('elist:homeCityChanged', {
            detail: { lat: accountCoords.lat, lng: accountCoords.lng, name },
          }));
        }).catch(() => {});
      }

      // 3. Показываем диалог только если пользователь ещё не принял решение
      if (isDecisionDone()) return;

      const current = await detectCurrentCoords();
      if (cancelled || !current) return;

      if (haversineKm(accountCoords, current) > CITY_CHANGE_THRESHOLD_KM) {
        const city = await getCityName(current);
        if (cancelled) return;
        setPendingCoords(current);
        setDetectedCity(city);
        setShowCityConfirm(true);
      } else {
        // Всё в порядке — запоминаем что диалог не нужен
        markDecisionDone();
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const confirmCity = () => {
    if (!pendingCoords) return;
    // Обновляем родной город в профиле
    updateLocation(pendingCoords.lat, pendingCoords.lng).catch(() => {});
    // Сохраняем новые координаты как текущие
    setCoords(pendingCoords);
    storeUserCoords(pendingCoords);
    storeAccountCoords(pendingCoords);
    // Сохраняем название родного города в отдельную cookie
    if (detectedCity) {
      cookies.set('elist_home_city_name', detectedCity, 30);
      cookies.set('elist_city_name', detectedCity, 30);
    }
    // Диспатчим событие чтобы FilterBar обновил city name
    window.dispatchEvent(new CustomEvent('elist:homeCityChanged', {
      detail: { lat: pendingCoords.lat, lng: pendingCoords.lng, name: detectedCity },
    }));
    markDecisionDone();
    setShowCityConfirm(false);
  };

  const keepOldCity = () => {
    // Пользователь остался в старом городе — просто закрываем диалог
    markDecisionDone();
    setShowCityConfirm(false);
  };

  // Слушаем изменение родного города из настроек профиля
  useEffect(() => {
    const handler = () => triggerCityCheck();
    window.addEventListener('elist:profileCityChanged', handler);
    return () => window.removeEventListener('elist:profileCityChanged', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerCityCheck = () => {
    clearCityDecision();
    setShowCityConfirm(false);
    setDetectedCity('');
    // Перезапускаем определение местоположения
    detectCurrentCoords().then(async current => {
      if (!current) return;
      const accountCoords = readUserCoords();
      if (!accountCoords) return;
      if (haversineKm(accountCoords, current) > CITY_CHANGE_THRESHOLD_KM) {
        const city = await getCityName(current);
        setPendingCoords(current);
        setDetectedCity(city);
        setShowCityConfirm(true);
      }
    }).catch(() => {});
  };

  return { coords, showCityConfirm, detectedCity, confirmCity, keepOldCity, triggerCityCheck };
}

export function getStoredUserCoords(): UserCoords {
  return readUserCoords() ?? MOSCOW;
}
