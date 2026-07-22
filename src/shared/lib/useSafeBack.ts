// shared/lib/useSafeBack.ts

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function readHistoryIdx(): number {
  const raw = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function readReturnTo(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const from = (state as { from?: unknown }).from;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return null;
  }
  return from;
}

/**
 * Безопасный «назад»: если пользователь пришёл по внешней/прямой ссылке
 * (истории внутри приложения нет) — ведём на переданный fallback вместо
 * выхода из сайта. React Router пишет индекс записи в history.state.idx.
 *
 * Если в location.state.from передан внутренний путь (например, с приглашений) —
 * используем его как запасной маршрут при битом idx.
 */
export function useSafeBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const idx = readHistoryIdx();
    if (idx > 0) {
      navigate(-1);
      return;
    }
    const from = readReturnTo(location.state);
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, fallback, location.state]);
}
