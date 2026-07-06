// shared/lib/datetime.ts — локальный календарь и конвертация UTC ↔ UI

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysLocalDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD как локальную календарную дату (без сдвига UTC) */
export function parseLocalDateString(isoDate: string): Date | null {
  const m = isoDate.match(DATE_ONLY_RE);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, mo - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

/** Локальная календарная дата из ISO с бэка (UTC или с offset) */
export function apiIsoToLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function apiIsoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Локальные дата+время → UTC ISO для API */
export function localPartsToApiIso(date: string, time: string): string {
  const [y, mo, day] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, day, h, mi, 0, 0).toISOString();
}

/** Дата рождения из API → YYYY-MM-DD для формы */
export function parseBirthDateFromApi(iso: string): string {
  if (!iso) return '';
  const head = iso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!head) return '';
  if (iso.length <= 10 || iso[10] === 'T') {
    if (iso.length <= 10) return head;
    return apiIsoToLocalDateString(iso);
  }
  return apiIsoToLocalDateString(iso);
}

/** YYYY-MM-DD из формы → ISO для API (полдень локально, без сдвига дня) */
export function birthDateToApiIso(date: string): string | undefined {
  if (!date) return undefined;
  const d = parseLocalDateString(date);
  if (!d) return undefined;
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function getAge(birthDateIso: string): number {
  const local = parseBirthDateFromApi(birthDateIso);
  const birth = parseLocalDateString(local) ?? new Date(birthDateIso);
  if (isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  return Math.max(0, age);
}

export function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'лет';
  if (mod10 === 1) return 'год';
  if (mod10 >= 2 && mod10 <= 4) return 'года';
  return 'лет';
}

export function formatAge(birthDateIso: string): string {
  const age = getAge(birthDateIso);
  return `${age} ${pluralYears(age)}`;
}
