// shared/auth/sessionUnauthorized.ts

let handler: (() => void) | null = null;
let handling = false;

export function registerSessionUnauthorizedHandler(fn: () => void): void {
  handler = fn;
}

/**
 * Сброс сессии при протухшем/невалидном токене.
 * С маршрутов RequireAuth — на главную + диалог входа (не жёсткий /login),
 * чтобы анонимный просмотр карты оставался доступен.
 */
export function handleSessionUnauthorized(): void {
  if (handling) return;
  handling = true;
  try {
    handler?.();
  } finally {
    window.setTimeout(() => { handling = false; }, 500);
  }
}
