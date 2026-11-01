// Окно кадра аватара: сдвиг и масштаб фото внутри круга.
// Наружу отдаётся уже обрезанный JPEG — API загрузки не меняется.
// При повторном открытии можно восстановить zoom/focus поверх исходника.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import {
  AVATAR_ZOOM_MAX,
  AVATAR_ZOOM_MIN,
  clampAvatarZoom,
  clampedPan,
  DEFAULT_AVATAR_CROP_FRAME,
  displayedSize,
  frameFocusFromPan,
  normalizeAvatarCropFrame,
  panForZoom,
  panFromFrameFocus,
  renderAvatarFile,
  sourceSquare,
  circleOrigin,
  type AvatarCropFrame,
} from './cropAvatar';
import styles from './AvatarCropDialog.module.css';

const CIRCLE_RATIO = 0.8;

export type AvatarCropShape = 'circle' | 'rounded-square';

function zoomPercent(zoom: number): number {
  const span = AVATAR_ZOOM_MAX - AVATAR_ZOOM_MIN;
  if (span <= 0) return 0;
  return Math.round(((clampAvatarZoom(zoom) - AVATAR_ZOOM_MIN) / span) * 100);
}

interface AvatarCropDialogProps {
  src: string | null;
  fileName: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (file: File, frame: AvatarCropFrame) => void | Promise<void>;
  title?: string;
  lead?: string;
  shape?: AvatarCropShape;
  /** Последний кадр поверх текущего src (исходник). Сброс при смене src без frame. */
  initialFrame?: AvatarCropFrame | null;
  /** «Выбрать фото...» поверх кадра. */
  onFilePicked?: (file: File) => void;
  /** «Удалить» поверх кадра. Нет колбэка — кнопки нет. */
  onDelete?: () => void | Promise<void>;
  deleteDisabled?: boolean;
  loadingImage?: boolean;
}

export function AvatarCropDialog({
  src,
  fileName,
  saving,
  onCancel,
  onConfirm,
  title = 'Кадр аватара',
  lead = 'Перетащите фото и подгоните масштаб. В круг попадёт то, что видно в окне.',
  shape = 'circle',
  initialFrame = null,
  onFilePicked,
  onDelete,
  deleteDisabled = false,
  loadingImage = false,
}: AvatarCropDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const pendingFrameRef = useRef<AvatarCropFrame>(
    normalizeAvatarCropFrame(initialFrame ?? DEFAULT_AVATAR_CROP_FRAME),
  );
  const appliedFrameKeyRef = useRef<string | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState(0);
  const [zoom, setZoom] = useState(() => clampAvatarZoom(initialFrame?.zoom ?? AVATAR_ZOOM_MIN));
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [decoded, setDecoded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const seenSrc = useRef(src);
  const seenFrameKey = useRef(`${src ?? ''}|${initialFrame?.zoom ?? ''}|${initialFrame?.focusX ?? ''}|${initialFrame?.focusY ?? ''}`);
  const frameKey = `${src ?? ''}|${initialFrame?.zoom ?? ''}|${initialFrame?.focusX ?? ''}|${initialFrame?.focusY ?? ''}`;
  if (seenSrc.current !== src || seenFrameKey.current !== frameKey) {
    seenSrc.current = src;
    seenFrameKey.current = frameKey;
    const nextFrame = normalizeAvatarCropFrame(initialFrame ?? DEFAULT_AVATAR_CROP_FRAME);
    pendingFrameRef.current = nextFrame;
    appliedFrameKeyRef.current = null;
    setNatural(null);
    setDecoded(false);
    setZoom(nextFrame.zoom);
    setPan({ x: 0, y: 0 });
    setError(null);
    setPreparing(false);
  }

  useModalBackButton(onCancel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !preparing) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, saving, preparing]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageSize(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Когда известны размеры картинки и stage — ставим сохранённый кадр.
  useLayoutEffect(() => {
    if (!natural || stageSize <= 0 || !src) return;
    const key = `${src}|${pendingFrameRef.current.zoom}|${pendingFrameRef.current.focusX}|${pendingFrameRef.current.focusY}|${natural.w}x${natural.h}|${stageSize}`;
    if (appliedFrameKeyRef.current === key) return;
    const frame = pendingFrameRef.current;
    const circle = stageSize * CIRCLE_RATIO;
    const nextPan = panFromFrameFocus(
      stageSize,
      natural.w,
      natural.h,
      circle,
      frame.zoom,
      frame.focusX,
      frame.focusY,
    );
    appliedFrameKeyRef.current = key;
    setZoom(frame.zoom);
    setPan({ x: nextPan.panX, y: nextPan.panY });
  }, [natural, stageSize, src]);

  const circleSize = stageSize * CIRCLE_RATIO;
  const disp = natural && stageSize > 0
    ? displayedSize(natural.w, natural.h, circleSize, zoom)
    : null;
  const placed = disp
    ? clampedPan(stageSize, disp.width, disp.height, circleSize, pan.x, pan.y)
    : null;

  const onZoom = (next: number) => {
    if (!natural || stageSize <= 0) {
      setZoom(next);
      return;
    }
    const circle = stageSize * CIRCLE_RATIO;
    const nextPan = panForZoom(stageSize, natural.w, natural.h, circle, zoom, next, pan.x, pan.y);
    setPan({ x: nextPan.panX, y: nextPan.panY });
    setZoom(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saving || preparing || !placed) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, panX: placed.panX, panY: placed.panY };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !disp) return;
    const circle = stageSize * CIRCLE_RATIO;
    const next = clampedPan(
      stageSize,
      disp.width,
      disp.height,
      circle,
      drag.panX + (e.clientX - drag.x),
      drag.panY + (e.clientY - drag.y),
    );
    setPan({ x: next.panX, y: next.panY });
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const save = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !image.complete || !natural || !disp || !placed || saving || preparing) return;
    const circle = circleOrigin(stageSize, circleSize);
    const square = sourceSquare(
      natural.w,
      natural.h,
      placed.left,
      placed.top,
      disp.width,
      disp.height,
      circle.left,
      circle.top,
      circleSize,
    );
    const focus = frameFocusFromPan(
      stageSize,
      natural.w,
      natural.h,
      circleSize,
      zoom,
      pan.x,
      pan.y,
    );
    const frame = normalizeAvatarCropFrame({ zoom, ...focus });
    setPreparing(true);
    setError(null);
    try {
      const file = await renderAvatarFile(image, square, fileName);
      await onConfirm(file, frame);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить фото');
      setPreparing(false);
    }
  }, [natural, disp, placed, saving, preparing, stageSize, circleSize, fileName, onConfirm, zoom, pan.x, pan.y]);

  const busy = saving || preparing;
  const percent = zoomPercent(zoom);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={() => { if (!busy) onCancel(); }} />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
      >
        <h2 id="image-crop-title" className={styles.title}>{title}</h2>
        <p className={styles.lead}>{lead}</p>

        <div
          ref={stageRef}
          className={`${styles.stage} ${dragging ? styles.stageDragging : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {disp && placed && src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              className={styles.photo}
              style={{ width: disp.width, height: disp.height, left: placed.left, top: placed.top }}
              onLoad={e => {
                const el = e.currentTarget;
                if (el.naturalWidth > 0) {
                  setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                  setDecoded(true);
                }
              }}
              onError={() => setError('Не удалось открыть это изображение')}
            />
          )}
          {!natural && !error && src && (
            <img
              src={src}
              alt=""
              className={styles.probe}
              onLoad={e => {
                const el = e.currentTarget;
                if (el.naturalWidth > 0) setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              onError={() => setError('Не удалось открыть это изображение')}
            />
          )}
          <div className={`${styles.shade} ${shape === 'rounded-square' ? styles.shadeSquare : styles.shadeCircle}`} />
          {(onFilePicked || onDelete) && (
            <div className={styles.stageTools}>
              {onFilePicked && (
                <button
                  type="button"
                  className={styles.pickBtn}
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выбрать фото...
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  disabled={busy || deleteDisabled}
                  onClick={() => {
                    void (async () => {
                      try {
                        await onDelete?.();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Не удалось удалить фото');
                      }
                    })();
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          )}
          {loadingImage && <div className={styles.stageStatus}>Загрузка фото…</div>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !onFilePicked) return;
              if (!file.type.startsWith('image/')) {
                setError('Выберите изображение');
                return;
              }
              setError(null);
              onFilePicked(file);
            }}
          />
        </div>

        <label className={styles.zoom}>
          <span>Масштаб {percent}%</span>
          <input
            type="range"
            min={AVATAR_ZOOM_MIN}
            max={AVATAR_ZOOM_MAX}
            step={0.01}
            value={zoom}
            aria-label={`Масштаб ${percent}%`}
            disabled={busy || !natural}
            onChange={e => onZoom(Number(e.target.value))}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button variant="secondary" fullWidth disabled={busy} onClick={onCancel}>Отмена</Button>
          <Button
            variant="primary"
            fullWidth
            loading={busy}
            disabled={!decoded || !!error}
            onClick={() => { void save(); }}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
