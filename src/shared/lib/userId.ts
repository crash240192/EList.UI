// shared/lib/userId.ts

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_PATH_RE = /\/user\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function isUserId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Извлекает UUID из идентификатора, ссылки на профиль или QR. */
export function parseUserIdFromText(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (isUserId(text)) return text;

  const pathMatch = text.match(USER_PATH_RE);
  if (pathMatch?.[1] && isUserId(pathMatch[1])) return pathMatch[1];

  const urlCandidates = [text];
  if (!/^https?:\/\//i.test(text)) {
    urlCandidates.push(`https://${text.replace(/^\/+/, '')}`);
  }

  for (const candidate of urlCandidates) {
    try {
      const url = new URL(candidate, window.location.origin);
      const match = url.pathname.match(USER_PATH_RE);
      if (match?.[1] && isUserId(match[1])) return match[1];
    } catch {
      // не URL
    }
  }

  const inline = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return inline?.[0] && isUserId(inline[0]) ? inline[0] : null;
}

/** Камера доступна в secure context — достаточно для html5-qrcode. */
export function canUseQrScanner(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
}
