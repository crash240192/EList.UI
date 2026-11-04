// Иконки маркеров карты из справочника категорий (API: ico + color).
// Одиночная точка: цвет категории + силуэт ico. Дебаг / без ico — точка в центре.
// Цвет иконки на маркере не зависит от темы приложения (рисуется в canvas).

import { fetchEventCategories } from '@/entities/event/dictionariesCache';
import type { IEventCategory } from '@/entities/event/types';
import { icoToUrl } from '@/shared/lib/icoToUrl';

/** CSS-размер иконки в круге маркера (исходники в API — 512×512). */
export const MAP_MARKER_ICON_SIZE = 18;

const INK_DARK = '#111827';
const INK_LIGHT = '#ffffff';

/** Тактические: иконка всегда чёрная, цвет круга не трогаем. */
const FORCE_BLACK_ICON_CATEGORY_IDS = new Set<string>([
  'b7d5cb98-f8fe-4eeb-bf9e-2792fc72fed7', // Тактические
]);

const FORCE_BLACK_ICON_NAMES = new Set<string>(['тактические']);

interface CategoryMarkerEntry {
  id: string;
  name: string;
  color: string;
  iconUrl: string | null;
  forceBlackIcon: boolean;
}

let byColor = new Map<string, CategoryMarkerEntry>();
let preloadPromise: Promise<void> | null = null;
const imageCache = new Map<string, HTMLImageElement | null>();

export function normalizeHexColor(color: string): string {
  const raw = color.trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('#') && raw.length === 4) {
    const r = raw[1], g = raw[2], b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return raw;
}

export function isLightMarkerColor(color: string): boolean {
  const hex = normalizeHexColor(color).replace('#', '');
  if (hex.length !== 6) return false;
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62;
}

function forceBlackIconFor(cat: IEventCategory): boolean {
  if (FORCE_BLACK_ICON_CATEGORY_IDS.has(cat.id)) return true;
  const name = cat.name.trim().toLowerCase().replace(/\s+/g, ' ');
  return FORCE_BLACK_ICON_NAMES.has(name);
}

function toEntry(cat: IEventCategory): CategoryMarkerEntry | null {
  const color = cat.color ? normalizeHexColor(cat.color) : '';
  if (!color) return null;
  return {
    id: cat.id,
    name: cat.name,
    color,
    iconUrl: icoToUrl(cat.ico),
    forceBlackIcon: forceBlackIconFor(cat),
  };
}

function indexCategories(categories: IEventCategory[]): void {
  const next = new Map<string, CategoryMarkerEntry>();
  for (const cat of categories) {
    const entry = toEntry(cat);
    if (!entry) continue;
    next.set(entry.color, entry);
  }
  byColor = next;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url) ?? null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

/** Прогрев категорий и их ico для маркеров. */
export function preloadMapCategoryIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = fetchEventCategories({ includeInactive: true })
    .then(async (categories) => {
      indexCategories(categories);
      const urls = [...new Set(
        [...byColor.values()].map(e => e.iconUrl).filter((u): u is string => Boolean(u)),
      )];
      await Promise.all(urls.map(loadImage));
    })
    .catch(() => {
      // Без справочника маркеры останутся цветными кругами без иконок
    });
  return preloadPromise;
}

export function getCachedMarkerIcon(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  return imageCache.get(url) ?? null;
}

function lookupByColor(apiColor: string | null | undefined): CategoryMarkerEntry | null {
  if (!apiColor) return null;
  return byColor.get(normalizeHexColor(apiColor)) ?? null;
}

/** Цвет круга = color из справочника категорий. */
export function displayMarkerColor(apiColor: string | null | undefined, fallback = '#6366f1'): string {
  const entry = lookupByColor(apiColor);
  if (entry) return entry.color;
  if (apiColor) return normalizeHexColor(apiColor) || fallback;
  return fallback;
}

/**
 * Ink маркера не зависит от темы UI: только от яркости круга
 * (и явного forceBlack для тактических).
 */
export function markerInkForDisplayColor(
  displayColor: string,
  forceBlackIcon = false,
): { light: boolean; ink: string; ring: string } {
  const lightFill = isLightMarkerColor(displayColor);
  const ink = forceBlackIcon || lightFill ? INK_DARK : INK_LIGHT;
  return {
    light: lightFill,
    ink,
    ring: lightFill ? '#c5c7d1' : '#ffffff',
  };
}

export function resolveMarkerPaint(apiColor: string | null | undefined, fallback = '#6366f1'): {
  fill: string;
  iconUrl: string | null;
  light: boolean;
  ink: string;
  ring: string;
} {
  const entry = lookupByColor(apiColor);
  const fill = entry?.color ?? displayMarkerColor(apiColor, fallback);
  const { light, ink, ring } = markerInkForDisplayColor(fill, entry?.forceBlackIcon ?? false);
  return {
    fill,
    iconUrl: entry?.iconUrl ?? null,
    light,
    ink,
    ring,
  };
}

/**
 * Рисует силуэт ico заданным цветом (не CSS-фильтром темы).
 * High-quality downscale из 512×512 в слот маркера.
 */
export function drawMarkerIconTinted(
  ctx: CanvasRenderingContext2D,
  icon: HTMLImageElement,
  dx: number,
  dy: number,
  size: number,
  tint: string,
): void {
  const tw = icon.naturalWidth || icon.width;
  const th = icon.naturalHeight || icon.height;
  if (!tw || !th) return;

  const tinted = document.createElement('canvas');
  tinted.width = tw;
  tinted.height = th;
  const tctx = tinted.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(icon, 0, 0);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = tint;
  tctx.fillRect(0, 0, tw, th);

  const scale = Math.min(size / tw, size / th);
  const dw = Math.max(1, Math.round(tw * scale));
  const dh = Math.max(1, Math.round(th * scale));
  const ox = dx + Math.floor((size - dw) / 2);
  const oy = dy + Math.floor((size - dh) / 2);

  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tinted, ox, oy, dw, dh);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQuality;
}
