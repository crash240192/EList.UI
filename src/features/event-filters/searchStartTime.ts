/** Календарный день «сегодня» для min в DatePicker (локальное время). */
export function searchStartTimeMinDate(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/** Не допускает «Дата от» раньше текущего момента. */
export function clampSearchStartTime(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  return d.getTime() < now ? new Date(now).toISOString() : iso;
}

export function normalizeSearchStartTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  return clampSearchStartTime(iso);
}
