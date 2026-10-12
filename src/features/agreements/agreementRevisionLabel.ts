/** Подпись даты последней редакции документа соглашения */

export function formatAgreementRevisionDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function agreementRevisionLabel(iso: string | null | undefined): string | null {
  const formatted = formatAgreementRevisionDate(iso);
  return formatted ? `Последняя редакция: ${formatted}` : null;
}
