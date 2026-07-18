// features/event/useEventAgeAccessDialog.ts
// При 13003 (доступ по возрасту):
// — аноним без согласия → модалка «мне есть 18»
// — авторизованный без ДР → предложить заполнить в настройках
// — авторизованный с возрастом < 18 → показать сообщение из ответа API

import { useCallback, useState } from 'react';
import { useAuthStore } from '@/app/store';
import { agreeAnonymousAge, getAnonymousAgeAgreement } from '@/entities/agreement';
import { getMyPersonInfo } from '@/entities/user/settingsApi';
import { isApiError, isEventAccessDeniedError } from '@/shared/api/apiErrorUtils';

export type EventAgeAccessResolution =
  | 'prompt-anonymous'
  | 'prompt-birthdate'
  | 'denied';

export interface EventAgeAccessResult {
  resolution: EventAgeAccessResolution;
  /** Текст ошибки из ответа API (для denied) */
  message: string | null;
}

function apiErrorMessage(err: unknown): string | null {
  if (!isApiError(err)) return null;
  return err.serverMessage || err.message || null;
}

/**
 * Разбирает 13003: нужна ли модалка анониму / ДР авторизованному, или сразу отказ.
 */
export async function resolveEventAgeAccessError(
  err: unknown,
  isAuthenticated: boolean,
): Promise<EventAgeAccessResult> {
  if (!isEventAccessDeniedError(err)) {
    return { resolution: 'denied', message: apiErrorMessage(err) };
  }

  const message = apiErrorMessage(err);

  if (!isAuthenticated) {
    try {
      const agreed = await getAnonymousAgeAgreement();
      if (agreed) return { resolution: 'denied', message };
    } catch {
      // нет соглашения
    }
    return { resolution: 'prompt-anonymous', message: null };
  }

  // Авторизованный
  try {
    const person = await getMyPersonInfo();
    if (!person?.birthDate) {
      return { resolution: 'prompt-birthdate', message: null };
    }
    // ДР указана (в т.ч. возраст < 18) — показываем текст ошибки из API
    return { resolution: 'denied', message };
  } catch {
    return { resolution: 'prompt-birthdate', message: null };
  }
}

export function useEventAgeAccessDialog(onGranted: () => void | Promise<void>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [anonymousDialogOpen, setAnonymousDialogOpen] = useState(false);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAccessError = useCallback(async (err: unknown): Promise<EventAgeAccessResult> => {
    const result = await resolveEventAgeAccessError(err, isAuthenticated);
    if (result.resolution === 'prompt-anonymous') setAnonymousDialogOpen(true);
    if (result.resolution === 'prompt-birthdate') setBirthDialogOpen(true);
    return result;
  }, [isAuthenticated]);

  const onAgeConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await agreeAnonymousAge();
      setAnonymousDialogOpen(false);
      await onGranted();
    } catch {
      // toast из apiClient
    } finally {
      setBusy(false);
    }
  }, [onGranted]);

  const onAgeDecline = useCallback(() => {
    setAnonymousDialogOpen(false);
  }, []);

  const onBirthClose = useCallback(() => {
    setBirthDialogOpen(false);
  }, []);

  return {
    /** @deprecated use anonymousDialogOpen */
    ageDialogOpen: anonymousDialogOpen,
    anonymousDialogOpen,
    birthDialogOpen,
    ageDialogBusy: busy,
    handleAccessError,
    onAgeConfirm,
    onAgeDecline,
    onBirthClose,
  };
}
