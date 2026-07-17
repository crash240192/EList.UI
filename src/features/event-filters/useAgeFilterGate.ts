// features/event-filters/useAgeFilterGate.ts
// Возрастной фильтр: анонимное согласие 18+, ДР для авторизованных, блок <18.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore, useToastStore } from '@/app/store';
import { agreeAnonymousAge, getAnonymousAgeAgreement } from '@/entities/agreement';
import type { IEventsSearchParams } from '@/entities/event';
import { getMyPersonInfo, savePersonInfo } from '@/entities/user/settingsApi';
import { birthDateToApiIso, getAge } from '@/shared/lib/datetime';
import {
  ageFilterSelectValue,
  getAgeFilterSelectOptions,
  parseAgeFilterValue,
} from '@/features/event-filters/ageFilter';

type SetFilter = <K extends keyof IEventsSearchParams>(
  key: K,
  value: IEventsSearchParams[K],
) => void;

interface PendingAgeFilter {
  ageLimit: number | undefined;
  adultOnly: boolean;
  selectValue: string;
}

function clearAgeFilters(setFilter: SetFilter) {
  setFilter('ageLimit', undefined);
  setFilter('adultOnly', false);
}

function applyAgeFilters(
  setFilter: SetFilter,
  ageLimit: number | undefined,
  adultOnly: boolean,
) {
  setFilter('ageLimit', ageLimit);
  setFilter('adultOnly', adultOnly);
}

export function useAgeFilterGate(
  filters: IEventsSearchParams,
  setFilter: SetFilter,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const toast = useToastStore((s) => s.add);

  /** null — ДР нет / ещё не загружена; число — возраст */
  const [userAge, setUserAge] = useState<number | null>(null);
  const [birthLoaded, setBirthLoaded] = useState(false);

  const [ageDialogOpen, setAgeDialogOpen] = useState(false);
  const [ageDialogBusy, setAgeDialogBusy] = useState(false);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [birthDialogBusy, setBirthDialogBusy] = useState(false);

  const pendingRef = useRef<PendingAgeFilter | null>(null);
  const agreedRef = useRef<boolean | null>(null);
  const guardingRef = useRef(false);

  // Загрузка ДР авторизованного пользователя
  useEffect(() => {
    if (!isAuthenticated) {
      setUserAge(null);
      setBirthLoaded(true);
      return;
    }
    let cancelled = false;
    setBirthLoaded(false);
    getMyPersonInfo()
      .then((p) => {
        if (cancelled) return;
        if (p?.birthDate) setUserAge(getAge(p.birthDate));
        else setUserAge(null);
      })
      .catch(() => {
        if (!cancelled) setUserAge(null);
      })
      .finally(() => {
        if (!cancelled) setBirthLoaded(true);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Если возраст < 18 — сбросить взрослые фильтры
  useEffect(() => {
    if (!isAuthenticated || !birthLoaded) return;
    if (userAge == null || userAge >= 18) return;
    if (filters.adultOnly || (filters.ageLimit != null && filters.ageLimit >= 18)) {
      clearAgeFilters(setFilter);
    }
  }, [
    birthLoaded,
    filters.adultOnly,
    filters.ageLimit,
    isAuthenticated,
    setFilter,
    userAge,
  ]);

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

  const openAgeDialog = useCallback((pending: PendingAgeFilter) => {
    pendingRef.current = pending;
    setAgeDialogOpen(true);
  }, []);

  const openBirthDialog = useCallback((pending: PendingAgeFilter) => {
    pendingRef.current = pending;
    setBirthDialogOpen(true);
  }, []);

  const setAgeFilterValue = useCallback(async (selectValue: string) => {
    const parsed = parseAgeFilterValue(selectValue);

    if (!parsed.requiresAdult) {
      applyAgeFilters(setFilter, parsed.ageLimit, parsed.adultOnly);
      return;
    }

    const pending: PendingAgeFilter = {
      ageLimit: parsed.ageLimit,
      adultOnly: parsed.adultOnly,
      selectValue,
    };

    // ── Авторизованный ──
    if (isAuthenticated) {
      if (!birthLoaded) return;

      if (userAge != null && userAge < 18) {
        toast('Фильтр 18+ недоступен для вашего возраста', 'info');
        return;
      }
      if (userAge != null && userAge >= 18) {
        applyAgeFilters(setFilter, parsed.ageLimit, parsed.adultOnly);
        return;
      }
      // ДР не указана
      openBirthDialog(pending);
      return;
    }

    // ── Аноним ──
    const agreed = await checkAgreed();
    if (agreed) {
      applyAgeFilters(setFilter, parsed.ageLimit, parsed.adultOnly);
      return;
    }
    openAgeDialog(pending);
  }, [
    birthLoaded,
    checkAgreed,
    isAuthenticated,
    openAgeDialog,
    openBirthDialog,
    setFilter,
    toast,
    userAge,
  ]);

  const onAgeConfirm = useCallback(async () => {
    setAgeDialogBusy(true);
    try {
      await agreeAnonymousAge();
      agreedRef.current = true;
      const pending = pendingRef.current;
      if (pending) {
        applyAgeFilters(setFilter, pending.ageLimit, pending.adultOnly);
      }
      pendingRef.current = null;
      setAgeDialogOpen(false);
    } catch {
      // toast уже из apiClient
    } finally {
      setAgeDialogBusy(false);
    }
  }, [setFilter]);

  const onAgeDecline = useCallback(() => {
    pendingRef.current = null;
    setAgeDialogOpen(false);
    if (filters.adultOnly || (filters.ageLimit != null && filters.ageLimit >= 18)) {
      clearAgeFilters(setFilter);
    }
  }, [filters.adultOnly, filters.ageLimit, setFilter]);

  const onBirthCancel = useCallback(() => {
    pendingRef.current = null;
    setBirthDialogOpen(false);
  }, []);

  const onBirthSave = useCallback(async (birthDateLocal: string) => {
    setBirthDialogBusy(true);
    try {
      const iso = birthDateToApiIso(birthDateLocal);
      if (!iso) {
        toast('Укажите корректную дату рождения', 'error');
        return;
      }
      await savePersonInfo({ birthDate: iso });
      const age = getAge(iso);
      setUserAge(age);

      const pending = pendingRef.current;
      pendingRef.current = null;
      setBirthDialogOpen(false);

      if (age < 18) {
        toast('Фильтр 18+ недоступен для вашего возраста', 'info');
        clearAgeFilters(setFilter);
        return;
      }
      if (pending) {
        applyAgeFilters(setFilter, pending.ageLimit, pending.adultOnly);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить дату рождения', 'error');
    } finally {
      setBirthDialogBusy(false);
    }
  }, [setFilter, toast]);

  // Deep-link / гидратация взрослых фильтров без согласия
  useEffect(() => {
    if (isAuthenticated) return;
    const needsGate =
      filters.adultOnly === true
      || (filters.ageLimit != null && filters.ageLimit >= 18);
    if (!needsGate) return;
    if (ageDialogOpen || guardingRef.current) return;
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
      const selectValue = ageFilterSelectValue(filters);
      const pending: PendingAgeFilter = {
        ageLimit: filters.ageLimit,
        adultOnly: filters.adultOnly === true,
        selectValue,
      };
      clearAgeFilters(setFilter);
      openAgeDialog(pending);
      guardingRef.current = false;
    })();

    return () => {
      cancelled = true;
      guardingRef.current = false;
    };
  }, [
    ageDialogOpen,
    checkAgreed,
    filters,
    filters.adultOnly,
    filters.ageLimit,
    isAuthenticated,
    openAgeDialog,
    setFilter,
  ]);

  // Deep-link для авторизованных без ДР / с возрастом <18
  useEffect(() => {
    if (!isAuthenticated || !birthLoaded) return;
    const needsAdult =
      filters.adultOnly === true
      || (filters.ageLimit != null && filters.ageLimit >= 18);
    if (!needsAdult) return;
    if (birthDialogOpen || guardingRef.current) return;

    if (userAge != null && userAge < 18) {
      clearAgeFilters(setFilter);
      return;
    }
    if (userAge != null && userAge >= 18) return;

    // Нет ДР — спросить
    guardingRef.current = true;
    const selectValue = ageFilterSelectValue(filters);
    const pending: PendingAgeFilter = {
      ageLimit: filters.ageLimit,
      adultOnly: filters.adultOnly === true,
      selectValue,
    };
    clearAgeFilters(setFilter);
    openBirthDialog(pending);
    guardingRef.current = false;
  }, [
    birthDialogOpen,
    birthLoaded,
    filters,
    filters.adultOnly,
    filters.ageLimit,
    isAuthenticated,
    openBirthDialog,
    setFilter,
    userAge,
  ]);

  const ageSelectOptions = getAgeFilterSelectOptions(
    isAuthenticated && birthLoaded ? userAge : null,
  );

  const clearAgeFilter = useCallback(() => {
    clearAgeFilters(setFilter);
  }, [setFilter]);

  return {
    ageSelectValue: ageFilterSelectValue(filters),
    ageSelectOptions,
    setAgeFilterValue,
    clearAgeFilter,
    ageDialogOpen,
    ageDialogBusy,
    onAgeConfirm,
    onAgeDecline,
    birthDialogOpen,
    birthDialogBusy,
    onBirthSave,
    onBirthCancel,
  };
}
