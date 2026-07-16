// features/event-filters/useAnonymousAgeGate.ts
// Для анонимного поиска: перед фильтром 18+ спрашиваем подтверждение возраста.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/app/store';
import { agreeAnonymousAge, getAnonymousAgeAgreement } from '@/entities/agreement';
import type { IEventsSearchParams } from '@/entities/event';

type SetFilter = <K extends keyof IEventsSearchParams>(
  key: K,
  value: IEventsSearchParams[K],
) => void;

const ADULT_AGE = 18;

export function needsAdultAgeConfirm(age: number | undefined | null): boolean {
  return age != null && age >= ADULT_AGE;
}

export function useAnonymousAgeGate(
  filters: IEventsSearchParams,
  setFilter: SetFilter,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingAgeRef = useRef<number | null>(null);
  /** Кэш: null — ещё не проверяли, true/false — результат get */
  const agreedRef = useRef<boolean | null>(null);
  /** Чтобы не зациклить сброс при гидратации URL */
  const guardingRef = useRef(false);

  const checkAgreed = useCallback(async (): Promise<boolean> => {
    if (agreedRef.current === true) return true;
    try {
      const ok = await getAnonymousAgeAgreement();
      agreedRef.current = ok;
      return ok;
    } catch {
      return false;
    }
  }, []);

  const openDialog = useCallback((age: number) => {
    pendingAgeRef.current = age;
    setDialogOpen(true);
  }, []);

  /** Установить ageLimit с проверкой 18+ для анонимов */
  const setAgeLimit = useCallback(async (value: number | undefined) => {
    if (isAuthenticated || !needsAdultAgeConfirm(value)) {
      setFilter('ageLimit', value);
      return;
    }

    const age = value as number;
    const agreed = await checkAgreed();
    if (agreed) {
      setFilter('ageLimit', age);
      return;
    }

    // Не ставим фильтр, пока пользователь не подтвердит
    openDialog(age);
  }, [checkAgreed, isAuthenticated, openDialog, setFilter]);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await agreeAnonymousAge();
      agreedRef.current = true;
      const age = pendingAgeRef.current ?? ADULT_AGE;
      setFilter('ageLimit', age);
      setDialogOpen(false);
      pendingAgeRef.current = null;
    } catch {
      // ошибка уже через api toast; фильтр не ставим
    } finally {
      setBusy(false);
    }
  }, [setFilter]);

  const onDecline = useCallback(() => {
    pendingAgeRef.current = null;
    setDialogOpen(false);
    // Сбрасываем фильтрацию по возрасту, если успели проставить (URL и т.п.)
    if (needsAdultAgeConfirm(filters.ageLimit)) {
      setFilter('ageLimit', undefined);
    }
  }, [filters.ageLimit, setFilter]);

  // Deep-link / гидратация: age≥18 без согласия — спросить или сбросить
  useEffect(() => {
    if (isAuthenticated) return;
    if (!needsAdultAgeConfirm(filters.ageLimit)) return;
    if (dialogOpen || guardingRef.current) return;
    if (agreedRef.current === true) return;

    let cancelled = false;
    guardingRef.current = true;

    (async () => {
      const agreed = await checkAgreed();
      if (cancelled) return;
      if (agreed) {
        guardingRef.current = false;
        return;
      }
      const age = filters.ageLimit as number;
      // Сначала убираем фильтр (как при отказе), затем показываем диалог
      setFilter('ageLimit', undefined);
      openDialog(age);
      guardingRef.current = false;
    })();

    return () => {
      cancelled = true;
      guardingRef.current = false;
    };
  }, [
    checkAgreed,
    dialogOpen,
    filters.ageLimit,
    isAuthenticated,
    openDialog,
    setFilter,
  ]);

  return {
    setAgeLimit,
    ageDialogOpen: dialogOpen,
    ageDialogBusy: busy,
    onAgeConfirm: onConfirm,
    onAgeDecline: onDecline,
  };
}
