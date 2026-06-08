// features/auth/activationNotice.ts

const STORAGE_KEY = 'elist_activation_notice';

export function storeActivationNotice(message: string): void {
  const text = message.trim();
  if (!text) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* ignore quota errors */
  }
}

/** Прочитать и удалить сохранённое уведомление (одноразово) */
export function takeActivationNotice(): string | null {
  try {
    const text = sessionStorage.getItem(STORAGE_KEY)?.trim();
    sessionStorage.removeItem(STORAGE_KEY);
    return text || null;
  } catch {
    return null;
  }
}
