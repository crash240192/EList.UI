// shared/auth/sessionUnauthorized.ts

import { agentDebugLog } from '@/shared/debug/agentLog';

let handler: (() => void) | null = null;
let handling = false;

export function registerSessionUnauthorizedHandler(fn: () => void): void {
  handler = fn;
}

/** Сброс сессии и переход на /login (обработчик регистрируется в router) */
export function handleSessionUnauthorized(): void {
  if (handling) return;
  handling = true;
  // #region agent log
  agentDebugLog({
    hypothesisId: 'H2',
    location: 'sessionUnauthorized.ts:handleSessionUnauthorized',
    message: 'handleSessionUnauthorized',
    data: {
      hasHandler: Boolean(handler),
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
    },
  });
  // #endregion
  try {
    handler?.();
  } finally {
    window.setTimeout(() => { handling = false; }, 500);
  }
}
