export function clampText(value: string, maxLength: number): string {
  if (maxLength < 0) return value;
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function textLengthError(length: number, maxLength: number): string | null {
  if (length > maxLength) {
    return `Не более ${maxLength.toLocaleString('ru-RU')} символов`;
  }
  return null;
}
