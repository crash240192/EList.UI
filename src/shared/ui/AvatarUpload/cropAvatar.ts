// Геометрия кадра. Круг аватара и скруглённый квадрат логотипа — только маска;
// на сервер уходит квадрат, который это окно описывает.

export const AVATAR_OUTPUT_SIZE = 1024;
export const AVATAR_ZOOM_MIN = 1;
export const AVATAR_ZOOM_MAX = 3;

export function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

/** Масштаб, при котором меньшая сторона картинки закрывает круг. */
export function coverScale(naturalWidth: number, naturalHeight: number, circleSize: number): number {
  return Math.max(circleSize / naturalWidth, circleSize / naturalHeight);
}

export function displayedSize(
  naturalWidth: number,
  naturalHeight: number,
  circleSize: number,
  zoom: number,
): { width: number; height: number } {
  const scale = coverScale(naturalWidth, naturalHeight, circleSize) * zoom;
  return { width: naturalWidth * scale, height: naturalHeight * scale };
}

export function circleOrigin(stageSize: number, circleSize: number): { left: number; top: number } {
  const left = (stageSize - circleSize) / 2;
  return { left, top: left };
}

/** Сдвиг картинки относительно центра окна, чтобы круг всегда был закрыт фото. */
export function clampedPan(
  stageSize: number,
  imageWidth: number,
  imageHeight: number,
  circleSize: number,
  panX: number,
  panY: number,
): { panX: number; panY: number; left: number; top: number } {
  const circle = circleOrigin(stageSize, circleSize);
  const minLeft = circle.left + circleSize - imageWidth;
  const maxLeft = circle.left;
  const minTop = circle.top + circleSize - imageHeight;
  const maxTop = circle.top;
  const left = clamp((stageSize - imageWidth) / 2 + panX, minLeft, maxLeft);
  const top = clamp((stageSize - imageHeight) / 2 + panY, minTop, maxTop);
  return {
    left,
    top,
    panX: left - (stageSize - imageWidth) / 2,
    panY: top - (stageSize - imageHeight) / 2,
  };
}

/** Пан, при котором центр круга смотрит в ту же точку фото после смены масштаба. */
export function panForZoom(
  stageSize: number,
  naturalWidth: number,
  naturalHeight: number,
  circleSize: number,
  prevZoom: number,
  nextZoom: number,
  panX: number,
  panY: number,
): { panX: number; panY: number } {
  const prevSize = displayedSize(naturalWidth, naturalHeight, circleSize, prevZoom);
  const prev = clampedPan(stageSize, prevSize.width, prevSize.height, circleSize, panX, panY);
  const relX = prevSize.width === 0 ? 0.5 : (stageSize / 2 - prev.left) / prevSize.width;
  const relY = prevSize.height === 0 ? 0.5 : (stageSize / 2 - prev.top) / prevSize.height;
  const nextSize = displayedSize(naturalWidth, naturalHeight, circleSize, nextZoom);
  const nextLeft = stageSize / 2 - relX * nextSize.width;
  const nextTop = stageSize / 2 - relY * nextSize.height;
  const nextPanX = nextLeft - (stageSize - nextSize.width) / 2;
  const nextPanY = nextTop - (stageSize - nextSize.height) / 2;
  const next = clampedPan(stageSize, nextSize.width, nextSize.height, circleSize, nextPanX, nextPanY);
  return { panX: next.panX, panY: next.panY };
}

export interface AvatarSourceSquare {
  sx: number;
  sy: number;
  size: number;
}

/** Квадрат исходного изображения, который сейчас виден в круге. */
export function sourceSquare(
  naturalWidth: number,
  naturalHeight: number,
  imageLeft: number,
  imageTop: number,
  imageWidth: number,
  imageHeight: number,
  circleLeft: number,
  circleTop: number,
  circleSize: number,
): AvatarSourceSquare {
  const scaleX = imageWidth === 0 ? 1 : naturalWidth / imageWidth;
  const scaleY = imageHeight === 0 ? 1 : naturalHeight / imageHeight;
  let sx = (circleLeft - imageLeft) * scaleX;
  let sy = (circleTop - imageTop) * scaleY;
  let size = circleSize * scaleX;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + size > naturalWidth) size = naturalWidth - sx;
  if (sy + size > naturalHeight) size = naturalHeight - sy;
  if (size < 1) size = 1;
  return { sx, sy, size };
}

export async function renderAvatarFile(
  image: CanvasImageSource,
  square: AvatarSourceSquare,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement('canvas');
  const output = AVATAR_OUTPUT_SIZE;
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось подготовить фото');
  ctx.drawImage(image, square.sx, square.sy, square.size, square.size, 0, 0, output, output);
  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
  if (!blob) throw new Error('Не удалось подготовить фото');
  const base = fileName.replace(/\.[^.]+$/, '').trim() || 'avatar';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
