// shared/lib/contactMaskFormat.ts — маски контактов (телефон, email) для визуального ввода

export interface MaskSegment {
  type: 'filled' | 'ghost' | 'sep';
  text: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    return mask.replace(/#/g, '#');
  }

  const name = typeName.toLowerCase();
  if (mask.includes('@') || name.includes('email') || name.includes('почт') || name.includes('mail')) {
    return '____@____.___';
  }

  if (mask.includes('\\d') && !mask.includes('@')) {
    return '+7 (###) ###-##-##';
  }

  return null;
}

function digitSlots(template: string): number {
  return (template.match(/#/g) ?? []).length;
}

function isPhoneTemplate(template: string): boolean {
  return template.includes('#');
}

function isEmailTemplate(template: string): boolean {
  return template.includes('@') && template.includes('_');
}

export function phoneDigitsFromValue(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.startsWith('7') && d.length >= 11) return d.slice(1, 11);
  if (d.startsWith('8') && d.length >= 11) return d.slice(1, 11);
  return d.slice(0, 10);
}

export function phoneCanonical(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  return d.length ? `+7${d}` : '';
}

/** Сырые символы для отображения маски. */
export function extractRawFromValue(template: string, value: string): string {
  if (isPhoneTemplate(template)) {
    return phoneDigitsFromValue(value);
  }
  if (isEmailTemplate(template)) {
    return value.replace(/[^a-zA-Z0-9@._+-]/g, '');
  }
  return value;
}

/** Собирает итоговую строку контакта по шаблону. */
export function composeContactValue(template: string, raw: string): string {
  if (isPhoneTemplate(template)) {
    return phoneCanonical(raw);
  }

  if (isEmailTemplate(template)) {
    const chars = raw.replace(/[^a-zA-Z0-9@._+-]/g, '');
    let ci = 0;
    let out = '';
    for (const ch of template) {
      if (ch === '_') {
        out += ci < chars.length ? chars[ci++] : '';
      } else {
        out += ch;
      }
    }
    return out + chars.slice(ci);
  }

  return raw;
}

export function processPhoneRaw(_template: string, raw: string): string {
  return raw.replace(/\D/g, '').slice(0, digitSlots('+7 (###) ###-##-##'));
}

export function processEmailRaw(_template: string, raw: string): string {
  return raw.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 64);
}

export function buildContactMaskSegments(template: string, raw: string): MaskSegment[] {
  const segments: MaskSegment[] = [];

  if (isPhoneTemplate(template)) {
    const digits = raw.replace(/\D/g, '').slice(0, digitSlots(template));
    let di = 0;
    for (const ch of template) {
      if (ch === '#') {
        const filled = di < digits.length;
        segments.push({
          type: filled ? 'filled' : 'ghost',
          text: filled ? digits[di++] : '#',
        });
      } else {
        segments.push({ type: 'sep', text: ch });
      }
    }
    return segments;
  }

  if (isEmailTemplate(template)) {
    const chars = raw.replace(/[^a-zA-Z0-9@._+-]/g, '');
    let ci = 0;
    for (const ch of template) {
      if (ch === '_') {
        const filled = ci < chars.length;
        segments.push({
          type: filled ? 'filled' : 'ghost',
          text: filled ? chars[ci++] : '_',
        });
      } else {
        segments.push({ type: 'sep', text: ch });
      }
    }
    if (ci < chars.length) {
      segments.push({ type: 'filled', text: chars.slice(ci) });
    }
    return segments;
  }

  return raw ? [{ type: 'filled', text: raw }] : [{ type: 'ghost', text: '_' }];
}

export function validateContactValue(value: string, mask: string | null): string | null {
  if (!value.trim()) return 'Введите контактные данные';
  if (!mask) return null;

  const trimmed = value.trim();

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
