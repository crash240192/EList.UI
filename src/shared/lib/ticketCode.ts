// shared/lib/ticketCode.ts
// Коды билетов: EL + 32 hex (Guid N), например ELA1B2C3...

const TICKET_CODE_RE = /^EL[0-9A-F]{32}$/i;
const TICKET_CODE_INLINE_RE = /EL[0-9A-F]{32}/i;

export function isTicketCode(value: string): boolean {
  return TICKET_CODE_RE.test(value.trim());
}

/** Извлекает код билета из сырого текста / QR (код, URL с ?code=, inline). */
export function parseTicketCodeFromText(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (isTicketCode(text)) return text.toUpperCase();

  const urlCandidates = [text];
  if (!/^https?:\/\//i.test(text)) {
    urlCandidates.push(`https://${text.replace(/^\/+/, '')}`);
  }

  for (const candidate of urlCandidates) {
    try {
      const url = new URL(candidate, window.location.origin);
      const fromQuery =
        url.searchParams.get('code')
        || url.searchParams.get('ticketCode')
        || url.searchParams.get('ticket');
      if (fromQuery && isTicketCode(fromQuery)) return fromQuery.toUpperCase();
    } catch {
      // не URL
    }
  }

  const inline = text.match(TICKET_CODE_INLINE_RE);
  return inline?.[0] ? inline[0].toUpperCase() : null;
}
