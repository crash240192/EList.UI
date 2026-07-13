// shared/lib/useSafeBack.ts

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Безопасный «назад»: если пользователь пришёл по внешней/прямой ссылке
 * (истории внутри приложения нет) — ведём на переданный fallback вместо
 * выхода из сайта. React Router пишет индекс записи в history.state.idx.
 */
export function useSafeBack(fallback = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
