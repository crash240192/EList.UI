// shared/lib/userId.ts

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Извлекает UUID из текста QR или ссылки на профиль. */
export function parseUserIdFromText(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (isUserId(text)) return text;

  try {
    const url = new URL(text, window.location.origin);
    const match = url.pathname.match(/\/user\/([0-9a-f-]{36})/i);
    if (match?.[1] && isUserId(match[1])) return match[1];
  } catch {
    // не URL — пробуем найти UUID в строке
  }

  const inline = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return inline?.[0] && isUserId(inline[0]) ? inline[0] : null;
}

export function canUseQrScanner(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && typeof (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => unknown }).BarcodeDetector === 'function';
}
