// features/auth/locationSession.ts
// Cookie-сессия города/карты — общая для useUserLocation и logout

import { cookies } from '@/shared/lib/cookies';

export interface UserCoords { lat: number; lng: number; }

export const COOKIE_LAT = 'elist_user_lat';
export const COOKIE_LNG = 'elist_user_lng';
export const COOKIE_ACCOUNT_LAT = 'elist_acct_lat';
export const COOKIE_ACCOUNT_LNG = 'elist_acct_lng';
export const COOKIE_DECISION_DONE = 'elist_city_decided';
export const COOKIE_LOCATION_ACCOUNT_ID = 'elist_location_account_id';
export const COOKIE_HOME_CITY_NAME = 'elist_home_city_name';
export const COOKIE_CITY_NAME = 'elist_city_name';

export function readCookieCoords(latKey: string, lngKey: string): UserCoords | null {
  const la = cookies.get(latKey), lo = cookies.get(lngKey);
  if (!la || !lo) return null;
  const lat = parseFloat(la), lng = parseFloat(lo);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}

export function writeCookieCoords(latKey: string, lngKey: string, c: UserCoords): void {
  cookies.set(latKey, String(c.lat), 30);
  cookies.set(lngKey, String(c.lng), 30);
}

export function readLocationAccountId(): string | null {
  return cookies.get(COOKIE_LOCATION_ACCOUNT_ID);
}

export function storeLocationAccountId(id: string): void {
  cookies.set(COOKIE_LOCATION_ACCOUNT_ID, id, 30);
}

/** Сброс города/карты при выходе — чтобы следующий аккаунт не унаследовал координаты. */
export function clearLocationSession(): void {
  cookies.delete(COOKIE_LAT);
  cookies.delete(COOKIE_LNG);
  cookies.delete(COOKIE_ACCOUNT_LAT);
  cookies.delete(COOKIE_ACCOUNT_LNG);
  cookies.delete(COOKIE_DECISION_DONE);
  cookies.delete(COOKIE_LOCATION_ACCOUNT_ID);
  cookies.delete(COOKIE_HOME_CITY_NAME);
  cookies.delete(COOKIE_CITY_NAME);
}

/** Синхронно обновляет фильтры и центр карты (FilterBar слушает это событие). */
export function notifyHomeCityChanged(c: UserCoords, name: string): void {
  if (name) {
    cookies.set(COOKIE_HOME_CITY_NAME, name, 30);
    cookies.set(COOKIE_CITY_NAME, name, 30);
  }
  window.dispatchEvent(new CustomEvent('elist:homeCityChanged', {
    detail: { lat: c.lat, lng: c.lng, name },
  }));
}
