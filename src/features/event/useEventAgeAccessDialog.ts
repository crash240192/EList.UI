// features/event/useEventAgeAccessDialog.ts
// При 13003 (доступ по возрасту) для анонима — проверить/запросить согласие 18+.

import { useCallback, useState } from 'react';
import { useAuthStore } from '@/app/store';
import { agreeAnonymousAge, getAnonymousAgeAgreement } from '@/entities/agreement';
import { isEventAccessDeniedError } from '@/shared/api/apiErrorUtils';

export type EventAgeAccessResolution = 'retry' | 'denied' | 'prompt';

/**
 * Обрабатывает ошибку доступа к мероприятию.
 * Для анонима без подтверждённого возраста возвращает 'prompt' (нужна модалка).
 */
export async function resolveEventAgeAccessError(
  err: unknown,
  isAuthenticated: boolean,
): Promise<EventAgeAccessResolution> {
  if (!isEventAccessDeniedError(err)) return 'denied';
  if (isAuthenticated) return 'denied';

  try {
    const agreed = await getAnonymousAgeAgreement();
    if (agreed) return 'denied';
  } catch {
    // нет соглашения — показываем диалог
  }
  return 'prompt';
}

export function useEventAgeAccessDialog(onGranted: () => void | Promise<void>) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAccessError = useCallback(async (err: unknown): Promise<EventAgeAccessResolution> => {
    const resolution = await resolveEventAgeAccessError(err, isAuthenticated);
    if (resolution === 'prompt') setOpen(true);
    return resolution;
  }, [isAuthenticated]);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await agreeAnonymousAge();
      setOpen(false);
      await onGranted();
    } catch {
      // toast из apiClient
    } finally {
      setBusy(false);
    }
  }, [onGranted]);

  const onDecline = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    ageDialogOpen: open,
    ageDialogBusy: busy,
    handleAccessError,
    onAgeConfirm: onConfirm,
    onAgeDecline: onDecline,
    openAgeDialog: () => setOpen(true),
    closeAgeDialog: () => setOpen(false),
  };
}
