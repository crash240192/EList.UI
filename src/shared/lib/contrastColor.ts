/** Белый или тёмный текст под цвет фона (hex). */
export function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) return '#ffffff';
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1a2e' : '#ffffff';
}
