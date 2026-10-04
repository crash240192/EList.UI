// Окно кадра аватара: сдвиг и масштаб фото внутри круга.
// Наружу отдаётся уже обрезанный JPEG — API загрузки не меняется.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import {
  AVATAR_ZOOM_MAX,
  AVATAR_ZOOM_MIN,
  clampedPan,
  displayedSize,
  panForZoom,
  renderAvatarFile,
  sourceSquare,
  circleOrigin,
} from './cropAvatar';
import styles from './AvatarCropDialog.module.css';

const CIRCLE_RATIO = 0.8;

interface AvatarCropDialogProps {
  src: string;
  fileName: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export function AvatarCropDialog({ src, fileName, saving, onCancel, onConfirm }: AvatarCropDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState(0);
  const [zoom, setZoom] = useState(AVATAR_ZOOM_MIN);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [decoded, setDecoded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    setPreparing(true);
    setError(null);
    try {
      const file = await renderAvatarFile(image, square, fileName);
      onConfirm(file);
    } catch {
      setError('Не удалось подготовить фото');
      setPreparing(false);
    }
  }, [natural, disp, placed, saving, preparing, stageSize, circleSize, fileName, onConfirm]);

  const busy = saving || preparing;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={() => { if (!busy) onCancel(); }} />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
      >
        <h2 id="avatar-crop-title" className={styles.title}>Кадр аватара</h2>
        <p className={styles.lead}>Перетащите фото и подгоните масштаб. В круг попадёт то, что видно в окне.</p>

        <div
          ref={stageRef}
          className={`${styles.stage} ${dragging ? styles.stageDragging : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {disp && placed && (
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
          {!natural && !error && (
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
          <div className={styles.shade} />
        </div>

        <label className={styles.zoom}>
          <span>Масштаб</span>
          <input
            type="range"
            min={AVATAR_ZOOM_MIN}
            max={AVATAR_ZOOM_MAX}
            step={0.01}
            value={zoom}
            aria-label="Масштаб"
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
