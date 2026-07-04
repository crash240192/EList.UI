// shared/auth/routes.ts — маршруты без авторизации и требующие входа

export const PUBLIC_AUTH_ROUTES = ['/login', '/activate', '/register'] as const;

/** Доступны без JWT (гостевой режим) */
export const PUBLIC_APP_ROUTE_PREFIXES = ['/', '/event/', '/user/'] as const;

/** Требуют авторизации */
export const AUTH_REQUIRED_ROUTE_PREFIXES = [
  '/my-events',
  '/invitations',
  '/event-albums',
  '/create-event',
  '/edit-event',
  '/settings',
  '/wallet',
  '/admin',
] as const;

export function isPublicAuthRoute(pathname = window.location.pathname): boolean {
  return PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route));
}

export function isPublicAppRoute(pathname = window.location.pathname): boolean {
  if (isPublicAuthRoute(pathname)) return true;
  if (pathname === '/') return true;
  return PUBLIC_APP_ROUTE_PREFIXES.some(
    prefix => prefix !== '/' && pathname.startsWith(prefix),
  );
}

export function requiresAuthRoute(pathname = window.location.pathname): boolean {
  return AUTH_REQUIRED_ROUTE_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Маршруты бокового меню, недоступные гостям */
export const AUTH_REQUIRED_NAV_PATHS = new Set<string>([
  '/my-events',
  '/invitations',
  '/event-albums',
  '/create-event',
  '/settings',
  '/wallet',
  '/admin',
]);
