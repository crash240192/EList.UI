// shared/lib/contactMaskFormat.ts
//
// Контракт с бэкендом:
// - contact_types.mask в БД = regex ВАЛИДАЦИИ (не шаблон ввода).
// - Визуальный ввод на фронте выбирается по kind (phone_ru | email | text).
// - Перед отправкой значение приводится к канону, который проходит regex
//   (для phone_ru — «+7 (XXX) XXX-XX-XX», как ContactValueNormalizer на API).

export type ContactInputKind = 'phone_ru' | 'email' | 'text';

export interface MaskSegment {
  type: 'filled' | 'ghost' | 'sep';
  text: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_SLOTS = 10;
const GHOST_CHAR = '_';
/** Шаблон визуального ввода телефона (не путать с regex в БД). */
export const PHONE_RU_INPUT_TEMPLATE = '+7 (###) ###-##-##';

export function isRegexMask(mask: string): boolean {
  return (
    mask.startsWith('^')
    || mask.includes('\\d')
    || mask.includes('\\w')
    || mask.includes('\\s')
    || mask.includes('?')
    || mask.includes('[')
  );
}

/** Определяет стратегию ввода/валидации по regex БД и имени типа. */
export function resolveContactInputKind(mask: string | null, typeName = ''): ContactInputKind {
  const name = typeName.toLowerCase();
  if (
    (mask?.includes('@') ?? false)
    || name.includes('email')
    || name.includes('почт')
    || name.includes('mail')
  ) {
    return 'email';
  }

  if (
    name.includes('телефон')
    || name.includes('phone')
    || name.includes('мобил')
    || (mask != null && isPhoneValidationMask(mask))
  ) {
    return 'phone_ru';
  }

  return 'text';
}

function isPhoneValidationMask(mask: string): boolean {
  return (
    isRegexMask(mask)
    && mask.includes('\\d')
    && !mask.includes('@')
    && (mask.includes('+7') || mask.includes('\\+7'))
  );
}

/**
 * Шаблон визуальной маски (# = цифра) или null = обычный input.
 * Email/text никогда не используют overlay-маску (на мобильных ломает caret/вёрстку).
 */
export function resolveContactMaskTemplate(mask: string | null, typeName = ''): string | null {
  const kind = resolveContactInputKind(mask, typeName);
  if (kind === 'phone_ru') return PHONE_RU_INPUT_TEMPLATE;
  if (mask && !isRegexMask(mask) && mask.includes('#')) return mask;
  return null;
}

function digitSlots(template: string): number {
  return (template.match(/#/g) ?? []).length || PHONE_DIGIT_SLOTS;
}

function isPhoneTemplate(template: string): boolean {
  return template.includes('#');
}

export function phoneDigitsFromValue(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.startsWith('7') && d.length > 1) return d.slice(1, 11);
  if (d.startsWith('8') && d.length > 1) return d.slice(1, 11);
  return d.slice(0, PHONE_DIGIT_SLOTS);
}

/** Канон для API / regex БД: +7 (XXX) XXX-XX-XX */
export function formatPhoneMasked(digits: string): string {
  const d = phoneDigitsFromValue(digits);
  if (!d.length) return '';
  if (d.length < PHONE_DIGIT_SLOTS) return `+7${d}`;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/** Компактный E.164-подобный: +7XXXXXXXXXX */
export function phoneApiValue(digits: string): string {
  const d = phoneDigitsFromValue(digits);
  return d.length ? `+7${d}` : '';
}

/** Сырое значение поля формы (цифры для телефона, текст для остального). */
export function extractRawFromValue(template: string, value: string): string {
  if (isPhoneTemplate(template)) {
    return phoneDigitsFromValue(value);
  }
  return value;
}

/**
 * Каноническое значение для API.
 * phone_ru → masked под regex БД; остальное — trim.
 */
export function composeContactValue(template: string, raw: string): string {
  if (isPhoneTemplate(template)) {
    return formatPhoneMasked(raw);
  }
  return raw.trim();
}

/** Канон по kind — единая точка для submit (без обязательного template). */
export function canonicalizeContactValue(
  value: string,
  mask: string | null,
  typeName = '',
): string {
  const kind = resolveContactInputKind(mask, typeName);
  const trimmed = value.trim();
  if (kind === 'phone_ru') {
    return formatPhoneMasked(trimmed);
  }
  if (kind === 'email') {
    return trimmed;
  }
  return trimmed;
}

export function processPhoneRaw(template: string, raw: string): string {
  return raw.replace(/\D/g, '').slice(0, digitSlots(template));
}

export function processEmailRaw(_template: string, raw: string): string {
  return raw.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 64);
}

export function buildContactMaskSegments(template: string, raw: string): MaskSegment[] {
  if (isPhoneTemplate(template)) {
    const digits = phoneDigitsFromValue(raw).slice(0, digitSlots(template));
    const segments: MaskSegment[] = [];
    let di = 0;
    for (const ch of template) {
      if (ch === '#') {
        const filled = di < digits.length;
        segments.push({
          type: filled ? 'filled' : 'ghost',
          text: filled ? digits[di++] : GHOST_CHAR,
        });
      } else {
        segments.push({ type: 'sep', text: ch });
      }
    }
    return segments;
  }

  return raw
    ? [{ type: 'filled', text: raw }]
    : [{ type: 'ghost', text: GHOST_CHAR }];
}

export function buildContactDisplayValue(template: string, raw: string): string {
  return buildContactMaskSegments(template, raw).map(seg => seg.text).join('');
}

/** Курсор сразу после последней введённой цифры в шаблоне телефона. */
export function getContactCaretIndex(template: string, raw: string): number {
  if (isPhoneTemplate(template)) {
    const digits = phoneDigitsFromValue(raw);
    let di = 0;
    let pos = 0;
    for (const ch of template) {
      if (ch === '#') {
        if (di >= digits.length) return pos;
        di++;
      }
      pos++;
    }
    return pos;
  }
  return buildContactDisplayValue(template, raw).length;
}

export function validateContactValue(value: string, mask: string | null, typeName = ''): string | null {
  if (!value.trim()) return 'Введите контактные данные';

  const kind = resolveContactInputKind(mask, typeName);
  const canonical = canonicalizeContactValue(value, mask, typeName);

  if (kind === 'phone_ru') {
    const digits = phoneDigitsFromValue(value);
    if (digits.length !== PHONE_DIGIT_SLOTS) {
      return 'Введите номер полностью: +7 (XXX) XXX-XX-XX';
    }
  }

  if (kind === 'email') {
    if (!EMAIL_REGEX.test(canonical)) {
      return 'Введите корректный email';
    }
  }

  // Regex из БД — источник истины для сервера; проверяем канон.
  if (mask && isRegexMask(mask)) {
    try {
      if (!new RegExp(mask).test(canonical)) {
        return 'Значение не соответствует требуемому формату';
      }
    } catch {
      // битый regex в справочнике — не блокируем клиента сверх kind-проверок
    }
  }

  return null;
}

export function getMaskInputMode(
  mask: string | null,
  typeName = '',
): 'search' | 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | undefined {
  const kind = resolveContactInputKind(mask, typeName);
  if (kind === 'email') return 'email';
  if (kind === 'phone_ru') return 'tel';
  return 'text';
}
