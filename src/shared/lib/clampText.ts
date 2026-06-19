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

/** С какой длины показывать счётчик (последние ~15% или 500 символов, но не раньше 85%) */
export function getTextLengthHintShowAt(maxLength: number): number {
  return Math.min(
    maxLength - 1,
    Math.max(Math.floor(maxLength * 0.85), maxLength - 500),
  );
}

export function shouldShowTextLengthHint(length: number, maxLength: number): boolean {
  return length >= getTextLengthHintShowAt(maxLength);
}

export function formatTextLengthCount(length: number, maxLength: number): string {
  const fmt = (n: number) => n.toLocaleString('ru-RU');
  return `${fmt(length)} / ${fmt(maxLength)}`;
}

export type TextLengthHintTone = 'near' | 'max';

export function getTextLengthHintTone(length: number, maxLength: number): TextLengthHintTone | null {
  if (!shouldShowTextLengthHint(length, maxLength)) return null;
  return length >= maxLength ? 'max' : 'near';
}
