// shared/lib/contactMask.ts
// Валидация контактов по regex-маске приходящей с бэкенда

/**
 * Проверяет значение по regex-маске из API.
 * mask — строка regex (например "^[^\s@]+@[^\s@]+\.[^\s@]+$")
 * Возвращает текст ошибки или null если всё ок.
 */
export function validateContactValue(value: string, mask: string | null): string | null {
  if (!value.trim()) return 'Введите контактные данные';
  if (!mask) return null;

  try {
    const regex = new RegExp(mask);
    if (!regex.test(value.trim())) {
      return `Значение не соответствует требуемому формату`;
    }
  } catch {
    // Невалидный regex — пропускаем валидацию
  }
  return null;
}

/**
 * Определяет тип клавиатуры для мобильных устройств по маске.
 */
export function getMaskInputMode(mask: string | null): React.HTMLAttributes<HTMLInputElement>['inputMode'] {
  if (!mask) return 'text';
  // Если в regex есть паттерны цифр и нет @/\w — скорее всего телефон
  if (mask.includes('\\d') && !mask.includes('@')) return 'tel';
  if (mask.includes('@')) return 'email';
  return 'text';
}
