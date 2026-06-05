// shared/lib/dateTimeMask.ts — маски дд.мм.гггг и чч:мм с проверкой допустимых значений

export const DATE_DIGITS = 8;
export const TIME_DIGITS = 4;

export function maxDigits(withTime: boolean): number {
  return withTime ? DATE_DIGITS + TIME_DIGITS : DATE_DIGITS;
}

function daysInMonth(month: number, year?: number): number {
  if (month < 1 || month > 12) return 31;
  if (year) return new Date(year, month, 0).getDate();
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function isValidDateDigit(existing: string, digit: number): boolean {
  const pos = existing.length;
  switch (pos) {
    case 0: return digit >= 0 && digit <= 3;
    case 1: {
      const d0 = parseInt(existing[0], 10);
      if (d0 === 0) return digit >= 1 && digit <= 9;
      if (d0 === 3) return digit >= 0 && digit <= 1;
      return digit >= 0 && digit <= 9;
    }
    case 2: return digit >= 0 && digit <= 1;
    case 3: {
      const m0 = parseInt(existing[2], 10);
      if (m0 === 0) return digit >= 1 && digit <= 9;
      if (m0 === 1) return digit >= 0 && digit <= 2;
      return false;
    }
    case 4:
    case 5:
    case 6:
    case 7:
      return digit >= 0 && digit <= 9;
    default:
      return false;
  }
}

function isValidDayMonth(dateDigits: string): boolean {
  if (dateDigits.length < 4) return true;
  const day = parseInt(dateDigits.slice(0, 2), 10);
  const month = parseInt(dateDigits.slice(2, 4), 10);
  if (month < 1 || month > 12 || day < 1) return false;
  const year = dateDigits.length >= 8 ? parseInt(dateDigits.slice(4, 8), 10) : undefined;
  return day <= daysInMonth(month, year);
}

function isValidYearRange(dateDigits: string, min?: string, max?: string): boolean {
  if (dateDigits.length < 8) return true;
  const year = parseInt(dateDigits.slice(4, 8), 10);
  if (min) {
    const minYear = parseInt(min.slice(0, 4), 10);
    if (year < minYear) return false;
  }
  if (max) {
    const maxYear = parseInt(max.slice(0, 4), 10);
    if (year > maxYear) return false;
  }
  return true;
}

export function isValidTimeDigit(existing: string, digit: number): boolean {
  const pos = existing.length;
  switch (pos) {
    case 0: return digit >= 0 && digit <= 2;
    case 1: {
      const h0 = parseInt(existing[0], 10);
      if (h0 === 2) return digit >= 0 && digit <= 3;
      return digit >= 0 && digit <= 9;
    }
    case 2: return digit >= 0 && digit <= 5;
    case 3: return digit >= 0 && digit <= 9;
    default:
      return false;
  }
}

/** Собирает строку цифр, отбрасывая недопустимые символы по позиции */
export function sanitizeDateTimeDigits(
  raw: string,
  withTime: boolean,
  min?: string,
  max?: string,
): string {
  const only = raw.replace(/\D/g, '');
  let datePart = '';

  for (let i = 0; i < only.length && i < DATE_DIGITS; i++) {
    const digit = parseInt(only[i], 10);
    if (!isValidDateDigit(datePart, digit)) break;
    datePart += only[i];
    if (!isValidDayMonth(datePart)) {
      datePart = datePart.slice(0, -1);
      break;
    }
    if (datePart.length === 8 && !isValidYearRange(datePart, min, max)) {
      datePart = datePart.slice(0, -1);
      break;
    }
  }

  if (!withTime) return datePart;

  let timePart = '';
  for (let i = DATE_DIGITS; i < only.length && i < maxDigits(true); i++) {
    const digit = parseInt(only[i], 10);
    if (!isValidTimeDigit(timePart, digit)) break;
    timePart += only[i];
  }
  return datePart + timePart;
}

export function sanitizeTimeDigits(raw: string): string {
  const only = raw.replace(/\D/g, '');
  let result = '';
  for (let i = 0; i < only.length && i < TIME_DIGITS; i++) {
    const digit = parseInt(only[i], 10);
    if (!isValidTimeDigit(result, digit)) break;
    result += only[i];
  }
  return result;
}

export function formatMaskedFromDigits(digits: string, withTime: boolean): string {
  const datePart = digits.slice(0, DATE_DIGITS);
  let out = '';
  if (datePart.length > 0) out += datePart.slice(0, 2);
  if (datePart.length > 2) out += '.' + datePart.slice(2, 4);
  if (datePart.length > 4) out += '.' + datePart.slice(4, 8);
  if (withTime && digits.length > DATE_DIGITS) {
    const timePart = digits.slice(DATE_DIGITS, DATE_DIGITS + TIME_DIGITS);
    out += ' ' + timePart.slice(0, 2);
    if (timePart.length > 2) out += ':' + timePart.slice(2, 4);
  }
  return out;
}

export function formatTimeMasked(digits: string): string {
  if (!digits) return '';
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += ':' + digits.slice(2, 4);
  return out;
}

export function timeDigitsToHM(digits: string): { h: string; m: string } | null {
  if (digits.length !== TIME_DIGITS) return null;
  return { h: digits.slice(0, 2), m: digits.slice(2, 4) };
}

export function hmToTimeDigits(h: string, m: string): string {
  return `${h}${m}`.replace(/\D/g, '').slice(0, TIME_DIGITS);
}

export function isTimeAtOrAfter(h: string, m: string, minH: number, minM: number): boolean {
  const hi = parseInt(h, 10);
  const mi = parseInt(m, 10);
  return hi > minH || (hi === minH && mi >= minM);
}
