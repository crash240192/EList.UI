// Иконки маркеров карты по корневым разделам (категориям).
// Одиночная точка: цвет первого типа + 16×16 PNG раздела.
// Дебаг и неизвестные — без иконки (точка в центре).

export const MAP_MARKER_ICON_SIZE = 16;

/** slug файла в /public/map-markers */
type MarkerIconSlug =
  | 'auto'
  | 'active'
  | 'food'
  | 'animals'
  | 'knowledge'
  | 'cinema'
  | 'culture'
  | 'fashion'
  | 'music'
  | 'holidays'
  | 'fun'
  | 'meetings'
  | 'sport'
  | 'tactical'
  | 'art'
  | 'theater'
  | 'circus'
  | 'humor';

const ICON_BY_CATEGORY_ID: Record<string, MarkerIconSlug> = {
  '2066eba5-feda-433d-9599-8020712e0404': 'auto',       // Авто/мото
  '9b3e4545-a093-4a8e-96b5-aece26dbc1bf': 'active',     // Активный отдых
  // Дебаг — без иконки
  'bef66d56-7ab7-462b-8086-849d7fd17be9': 'food',       // Еда
  'f9efb2d9-40af-4730-b194-8f177430a9ad': 'animals',    // Животные
  '0c73d8bb-589b-480a-a6fb-e3916e945825': 'knowledge',  // Знания
  'aab7ad58-0d73-48b6-850c-e5ccb3819cbb': 'cinema',     // Кино
  'e24a2a0e-6ed5-481e-a205-eae0d0f97ab2': 'culture',    // Культура/субкультура
  'c760f23e-90b3-4bb5-8ee3-eb9f710097fd': 'fashion',    // Мода
  '4fa12cfd-396f-43e3-a0fc-13a678c750cb': 'music',      // Музыка
  'd176bda5-16ad-4912-80e1-0be3d89e654c': 'holidays',   // Праздники
  '9af4827b-c966-445b-a0ea-2ec8bae765b0': 'fun',        // Развлечения
  '29eb5091-b6f9-4c03-8bcf-3024f9f41022': 'meetings',   // Собрания
  'e9a92367-8bf6-41e7-9d6d-cf48c031a47f': 'sport',      // Спорт
  'b7d5cb98-f8fe-4eeb-bf9e-2792fc72fed7': 'tactical',   // Тактические
  '7ba606aa-6732-45e1-bbbe-698181888eba': 'art',        // Творчество
  '37da4480-2dff-41e7-bca6-3ce667043755': 'theater',    // Театр
  '7dbd5e48-163d-4579-a82a-ef98a296fa88': 'circus',     // Цирк
  '431ed878-c982-4f8d-842a-bee5fdc3890e': 'humor',      // Юмор
};

const ICON_BY_CATEGORY_NAME: Record<string, MarkerIconSlug> = {
  'авто/мото': 'auto',
  'активный отдых': 'active',
  'еда': 'food',
  'животные': 'animals',
  'знания': 'knowledge',
  'кино': 'cinema',
  'культура/субкультура': 'culture',
  'мода': 'fashion',
  'музыка': 'music',
  'праздники': 'holidays',
  'развлечения': 'fun',
  'собрания': 'meetings',
  'спорт': 'sport',
  'тактические': 'tactical',
  'творчество': 'art',
  'театр': 'theater',
  'цирк': 'circus',
  'юмор': 'humor',
};

const ICON_BY_COLOR: Record<string, MarkerIconSlug> = {
  '#ff0000': 'auto',
  '#876949': 'active',
  '#e68787': 'food',
  '#a34a21': 'animals',
  '#2b448f': 'knowledge',
  '#ffffff': 'cinema',
  '#42ff8b': 'culture',
  '#ff00c8': 'fashion',
  '#8400ff': 'music',
  '#dae892': 'holidays',
  '#f0cca8': 'fun',
  '#1f4378': 'meetings',
  '#0000ff': 'sport',
  '#758f6a': 'tactical',
  '#a1a7ff': 'art',
  '#ab5300': 'theater',
  '#0097bd': 'circus',
  '#ffff00': 'humor',
};

function slugToUrl(slug: MarkerIconSlug): string {
  return `/map-markers/${slug}.png`;
}

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

export function resolveMarkerIconSlug(opts: {
  categoryId?: string | null;
  categoryName?: string | null;
  color?: string | null;
}): MarkerIconSlug | null {
  const id = opts.categoryId?.trim();
  if (id && ICON_BY_CATEGORY_ID[id]) return ICON_BY_CATEGORY_ID[id];

  const name = (opts.categoryName ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (name && ICON_BY_CATEGORY_NAME[name]) return ICON_BY_CATEGORY_NAME[name];

  const color = opts.color ? normalizeHexColor(opts.color) : '';
  if (color && ICON_BY_COLOR[color]) return ICON_BY_COLOR[color];

  return null;
}

export function markerIconUrlForSlug(slug: MarkerIconSlug | null | undefined): string | null {
  return slug ? slugToUrl(slug) : null;
}

/** URL иконки по первому цвету точки search/short (цвет первого типа). */
export function markerIconUrlForColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const slug = resolveMarkerIconSlug({ color });
  return markerIconUrlForSlug(slug);
}

const imageCache = new Map<string, HTMLImageElement | null>();
let preloadPromise: Promise<void> | null = null;

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

/** Прогрев всех известных иконок маркеров. */
export function preloadMapCategoryIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const urls = [...new Set(Object.values(ICON_BY_CATEGORY_ID).map(slugToUrl))];
  preloadPromise = Promise.all(urls.map(loadImage)).then(() => undefined);
  return preloadPromise;
}

export function getCachedMarkerIcon(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  return imageCache.get(url) ?? null;
}

/**
 * Рисует силуэт иконки (чёрный PNG) белым или чёрным в целевой canvas.
 * Вписывает в квадрат size×size с сохранением пропорций.
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

  const scale = Math.min(size / tw, size / th);
  const dw = Math.max(1, Math.round(tw * scale));
  const dh = Math.max(1, Math.round(th * scale));
  const ox = dx + Math.floor((size - dw) / 2);
  const oy = dy + Math.floor((size - dh) / 2);

  const tmp = document.createElement('canvas');
  tmp.width = dw;
  tmp.height = dh;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(icon, 0, 0, dw, dh);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = tint;
  tctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(tmp, ox, oy);
}
