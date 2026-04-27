// shared/lib/icoToUrl.ts
// Определяет MIME-тип иконки по первым байтам base64 и формирует data URL

export function icoToUrl(ico: string | null | undefined): string | null {
  if (!ico) return null;
  if (ico.startsWith('data:') || ico.startsWith('http') || ico.startsWith('/')) return ico;
  if (ico.length < 10) return null;

  // PHN / PD9 / PD94 — SVG в base64 (<sv, <?x, <?xm)
  const isSvg = ico.startsWith('PHN') || ico.startsWith('PD9') || ico.startsWith('PD94');
  const mime  = isSvg ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${ico}`;
}

/** CSS-фильтр для инверсии чёрных иконок в тёмной теме */
export const ICO_DARK_FILTER = 'invert(1) brightness(2)';
