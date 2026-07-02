// features/auth/useUserLocation.ts

import { useState, useEffect } from 'react';
import { updateLocation } from '@/entities/user/settingsApi';
import { cookies } from '@/shared/lib/cookies';
import { apiClient, isAuthenticated } from '@/shared/api/client';
import { useAuthStore } from '@/app/store';
import {
  type UserCoords,
  COOKIE_LAT,
  COOKIE_LNG,
  COOKIE_ACCOUNT_LAT,
  COOKIE_ACCOUNT_LNG,
  COOKIE_DECISION_DONE,
  COOKIE_HOME_CITY_NAME,
  COOKIE_CITY_NAME,
  readCookieCoords,
  writeCookieCoords,
  readLocationAccountId,
  storeLocationAccountId,
  notifyHomeCityChanged,
} from './locationSession';

export type { UserCoords };

const MOSCOW: UserCoords = { lat: 55.7558, lng: 37.6173 };
const CITY_CHANGE_THRESHOLD_KM = 200;
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

function refreshHomeCityName(accountCoords: UserCoords, cancelled: () => boolean): void {
  getCityName(accountCoords).then(name => {
    if (cancelled() || !name) return;
    notifyHomeCityChanged(accountCoords, name);
  }).catch(() => {});
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
  const token = useAuthStore(s => s.token);
  const [coords,          setCoords]          = useState<UserCoords>(readUserCoords() ?? MOSCOW);
  const [showCityConfirm, setShowCityConfirm] = useState(false);
  const [detectedCity,    setDetectedCity]    = useState('');
  const [pendingCoords,   setPendingCoords]   = useState<UserCoords | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function init() {
      let accountCoords: UserCoords | null = null;
      let accountId: string | null = null;

      if (isAuthenticated()) {
        try {
          const r = await apiClient.get<{ id?: string; latitude?: number; longitude?: number }>('/api/accounts/getData');
          const d = r.result;
          accountId = d?.id ?? null;
          const lat = Number(d?.latitude);
          const lng = Number(d?.longitude);
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            accountCoords = { lat, lng };
          }
        } catch {}
      }
      if (cancelled) return;

      if (!accountCoords) {
        const cached = readUserCoords();
        if (cached) { setCoords(cached); return; }
        const detected = await detectCurrentCoords();
        if (cancelled) return;
        const fallback = detected ?? MOSCOW;
        setCoords(fallback);
        storeUserCoords(fallback);
        return;
      }

      const prevLocationAccountId = readLocationAccountId();
      const switchedAccount = !!accountId && accountId !== prevLocationAccountId;
      if (accountId) storeLocationAccountId(accountId);

      const prevAccountCoords = readAccountCoords();
      const coordsChanged = !prevAccountCoords
        || haversineKm(prevAccountCoords, accountCoords) > ACCOUNT_CHANGE_THRESHOLD_KM;

      if (switchedAccount || coordsChanged) {
        clearCityDecision();
        storeAccountCoords(accountCoords);
        setCoords(accountCoords);
        storeUserCoords(accountCoords);
        notifyHomeCityChanged(accountCoords, cookies.get(COOKIE_HOME_CITY_NAME) ?? '');
        refreshHomeCityName(accountCoords, isCancelled);
      } else {
        const userChosen = readUserCoords();
        if (userChosen) {
          setCoords(userChosen);
        } else {
          setCoords(accountCoords);
          storeUserCoords(accountCoords);
          notifyHomeCityChanged(accountCoords, cookies.get(COOKIE_HOME_CITY_NAME) ?? '');
        }
      }

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
        markDecisionDone();
      }
    }

    init();
    return () => { cancelled = true; };
  }, [token]);

  const confirmCity = () => {
    if (!pendingCoords) return;
    updateLocation(pendingCoords.lat, pendingCoords.lng).catch(() => {});
    setCoords(pendingCoords);
    storeUserCoords(pendingCoords);
    storeAccountCoords(pendingCoords);
    if (detectedCity) {
      notifyHomeCityChanged(pendingCoords, detectedCity);
    }
    markDecisionDone();
    setShowCityConfirm(false);
  };

  const keepOldCity = () => {
    markDecisionDone();
    setShowCityConfirm(false);
  };

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

export { clearLocationSession } from './locationSession';

export function getStoredUserCoords(): UserCoords {
  return readUserCoords() ?? MOSCOW;
}
