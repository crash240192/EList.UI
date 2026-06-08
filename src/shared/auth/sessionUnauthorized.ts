// shared/auth/sessionUnauthorized.ts

let handler: (() => void) | null = null;
let handling = false;

export function registerSessionUnauthorizedHandler(fn: () => void): void {
  handler = fn;
}

/** Сброс сессии и переход на /login (обработчик регистрируется в router) */
export function handleSessionUnauthorized(): void {
  if (handling) return;
  handling = true;
  try {
    handler?.();
  } finally {
    window.setTimeout(() => { handling = false; }, 500);
  }
}
