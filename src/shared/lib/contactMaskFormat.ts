// shared/lib/contactMaskFormat.ts — маски контактов (телефон, email) для визуального ввода

export interface MaskSegment {
  type: 'filled' | 'ghost' | 'sep';
  text: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_SLOTS = 10;
const GHOST_CHAR = '_';

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

/** Человекочитаемый шаблон или вывод из regex-маски API. */
export function resolveContactMaskTemplate(mask: string | null, typeName = ''): string | null {
  if (!mask) return null;

  if (!isRegexMask(mask)) {
    return mask;
  }

  const name = typeName.toLowerCase();
  if (mask.includes('@') || name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return '_@_._';
  }

  if (mask.includes('\\d') && !mask.includes('@')) {
    return '+7 (###) ###-##-##';
  }

  return null;
}

function digitSlots(template: string): number {
  return (template.match(/#/g) ?? []).length || PHONE_DIGIT_SLOTS;
}

function isPhoneTemplate(template: string): boolean {
  return template.includes('#');
}

function isEmailTemplate(template: string): boolean {
  return template.includes('@') && template.includes('_');
}

export function phoneDigitsFromValue(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.startsWith('7') && d.length > 1) return d.slice(1, 11);
  if (d.startsWith('8') && d.length > 1) return d.slice(1, 11);
  return d.slice(0, PHONE_DIGIT_SLOTS);
}

/** Каноническое значение телефона для API / regex-валидации. */
export function phoneCanonical(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, PHONE_DIGIT_SLOTS);
  return d.length ? `+7${d}` : '';
}

/** Сырые символы, которые вводит пользователь (без литералов маски). */
export function extractRawFromValue(template: string, value: string): string {
  if (isPhoneTemplate(template)) {
    if (value.startsWith('+') || value.startsWith('7') || value.startsWith('8')) {
      return phoneDigitsFromValue(value);
    }
    return value.replace(/\D/g, '').slice(0, digitSlots(template));
  }
  if (isEmailTemplate(template)) {
    return value.replace(/[^a-zA-Z0-9@._+-]/g, '');
  }
  return value;
}

/**
 * Собирает итоговую строку для отправки на API.
 * Вызывается при валидации и submit — не на каждый keystroke.
 */
export function composeContactValue(template: string, raw: string): string {
  if (isPhoneTemplate(template)) {
    return phoneCanonical(raw);
  }
  if (isEmailTemplate(template)) {
    return raw.replace(/[^a-zA-Z0-9@._+-]/g, '');
  }
  return raw;
}

export function processPhoneRaw(template: string, raw: string): string {
  return raw.replace(/\D/g, '').slice(0, digitSlots(template));
}

export function processEmailRaw(_template: string, raw: string): string {
  return raw.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 64);
}

export function buildContactMaskSegments(template: string, raw: string): MaskSegment[] {
  if (isPhoneTemplate(template)) {
    const digits = raw.replace(/\D/g, '').slice(0, digitSlots(template));
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

  if (isEmailTemplate(template)) {
    const segments: MaskSegment[] = [];
    let ri = 0;
    for (const tch of template) {
      if (tch === '_') {
        if (ri < raw.length) {
          segments.push({ type: 'filled', text: raw[ri++] });
        } else {
          segments.push({ type: 'ghost', text: GHOST_CHAR });
        }
      } else if (tch === '@' || tch === '.') {
        if (ri < raw.length && raw[ri] === tch) {
          segments.push({ type: 'sep', text: tch });
          ri++;
        } else {
          segments.push({ type: 'ghost', text: tch });
        }
      } else {
        segments.push({ type: 'sep', text: tch });
      }
    }
    if (ri < raw.length) {
      segments.push({ type: 'filled', text: raw.slice(ri) });
    }
    return segments;
  }

  return raw
    ? [{ type: 'filled', text: raw }]
    : [{ type: 'ghost', text: GHOST_CHAR }];
}

export function validateContactValue(value: string, mask: string | null, typeName = ''): string | null {
  if (!value.trim()) return 'Введите контактные данные';
  if (!mask) return null;

  const template = resolveContactMaskTemplate(mask, typeName);
  const trimmed = template
    ? composeContactValue(template, extractRawFromValue(template, value))
    : value.trim();

  if (isRegexMask(mask)) {
    try {
      const regex = new RegExp(mask);
      if (!regex.test(trimmed)) {
        return 'Значение не соответствует требуемому формату';
      }
    } catch {
      // невалидный regex
    }
    return null;
  }

  if (mask.includes('@')) {
    if (!EMAIL_REGEX.test(trimmed)) {
      return 'Значение не соответствует требуемому формату';
    }
  }

  return null;
}

export function getMaskInputMode(
  mask: string | null,
  typeName = '',
): 'search' | 'text' | 'none' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | undefined {
  const template = resolveContactMaskTemplate(mask, typeName);
  if (!template) return 'text';
  if (template.includes('#')) return 'tel';
  if (template.includes('@')) return 'email';
  return 'text';
}
