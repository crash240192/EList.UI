// Иконки маркеров карты из справочника категорий (API: ico + color).
// Белый диск + чёрный силуэт ico; кант — color категорий (при нескольких — сектора).
// Без фильтра типов/категорий — иконка первой категории события.
// С фильтром — иконка совпавшей категории (несовпадающие события в выдаче не приходят).

import { fetchEventCategories, fetchEventTypes } from '@/entities/event/dictionariesCache';
import type { IEventCategory } from '@/entities/event/types';
import { icoToUrl } from '@/shared/lib/icoToUrl';

/** CSS-размер иконки в круге маркера (исходники в API — 512×512). */
export const MAP_MARKER_ICON_SIZE = 18;

/** Чёрная иконка на белом диске — не зависит от темы UI. */
export const MARKER_ICON_INK = '#111827';
export const MARKER_FILL = '#ffffff';

interface CategoryMarkerEntry {
  id: string;
  name: string;
  color: string;
  iconUrl: string | null;
}

let byColor = new Map<string, CategoryMarkerEntry>();
let byId = new Map<string, CategoryMarkerEntry>();
/** typeId → categoryId */
let typeToCategoryId = new Map<string, string>();
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

function toEntry(cat: IEventCategory): CategoryMarkerEntry | null {
  const color = cat.color ? normalizeHexColor(cat.color) : '';
  if (!color) return null;
  return {
    id: cat.id,
    name: cat.name,
    color,
    iconUrl: icoToUrl(cat.ico),
  };
}

function indexCategories(categories: IEventCategory[]): void {
  const nextColor = new Map<string, CategoryMarkerEntry>();
  const nextId = new Map<string, CategoryMarkerEntry>();
  for (const cat of categories) {
    const entry = toEntry(cat);
    if (!entry) continue;
    nextColor.set(entry.color, entry);
    nextId.set(entry.id, entry);
  }
  byColor = nextColor;
  byId = nextId;
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

/** Прогрев категорий, типов (для фильтра) и ico. */
export function preloadMapCategoryIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all([
    fetchEventCategories({ includeInactive: true }),
    fetchEventTypes(undefined, { includeInactive: true }),
  ])
    .then(async ([categories, types]) => {
      indexCategories(categories);
      const typeMap = new Map<string, string>();
      for (const t of types) {
        if (t.id && t.eventCategoryId) typeMap.set(t.id, t.eventCategoryId);
      }
      typeToCategoryId = typeMap;
      const urls = [...new Set(
        [...byId.values()].map(e => e.iconUrl).filter((u): u is string => Boolean(u)),
      )];
      await Promise.all(urls.map(loadImage));
    })
    .catch(() => {
      // Без справочника маркеры останутся с кантом из сырых colors[] без иконок
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

/** Цвет категории для UI (список на точке и т.п.). */
export function displayMarkerColor(apiColor: string | null | undefined, fallback = '#6366f1'): string {
  const entry = lookupByColor(apiColor);
  if (entry) return entry.color;
  if (apiColor) return normalizeHexColor(apiColor) || fallback;
  return fallback;
}

export interface MarkerTypeCategoryFilter {
  categories?: string[] | null;
  types?: string[] | null;
}

function preferredCategoryIds(filter?: MarkerTypeCategoryFilter | null): Set<string> {
  const ids = new Set<string>();
  for (const id of filter?.categories ?? []) {
    if (id) ids.add(id);
  }
  for (const typeId of filter?.types ?? []) {
    const catId = typeToCategoryId.get(typeId);
    if (catId) ids.add(catId);
  }
  return ids;
}

/** Уникальные цвета канта по colors[] события (порядок сохранения). */
export function resolveRingColors(apiColors: string[], fallback = '#6366f1'): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of apiColors) {
    if (!raw) continue;
    const color = displayMarkerColor(raw, fallback);
    if (seen.has(color)) continue;
    seen.add(color);
    out.push(color);
  }
  return out.length ? out : [fallback];
}

/**
 * Иконка маркера: при активном фильтре типов/категорий — совпавшая категория;
 * иначе — первая категория события.
 */
export function resolveMarkerIcon(
  apiColors: string[],
  filter?: MarkerTypeCategoryFilter | null,
): { iconUrl: string | null; entryId: string | null } {
  const entries = apiColors
    .map(c => lookupByColor(c))
    .filter((e): e is CategoryMarkerEntry => e != null);

  if (!entries.length) return { iconUrl: null, entryId: null };

  const preferred = preferredCategoryIds(filter);
  if (preferred.size > 0) {
    const match = entries.find(e => preferred.has(e.id));
    if (match) return { iconUrl: match.iconUrl, entryId: match.id };
    // Несовпавшие события не должны попадать в выдачу; на всякий случай — первая.
  }

  return { iconUrl: entries[0].iconUrl, entryId: entries[0].id };
}

export function resolveMarkerVisual(
  apiColors: string[],
  filter?: MarkerTypeCategoryFilter | null,
  fallback = '#6366f1',
): {
  ringColors: string[];
  iconUrl: string | null;
  fill: string;
  ink: string;
} {
  const ringColors = resolveRingColors(apiColors, fallback);
  const { iconUrl } = resolveMarkerIcon(apiColors, filter);
  return {
    ringColors,
    iconUrl,
    fill: MARKER_FILL,
    ink: MARKER_ICON_INK,
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
