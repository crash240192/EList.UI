import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadFile } from '@/shared/api/fileStorageClient';
import {
  rememberHeaderBlurPercent,
  saveHeaderBlurPercent,
  setAccountHeader,
} from '@/entities/user/headerApi';
import {
  clampCoverFocusValue,
  coverObjectPosition,
  DEFAULT_COVER_FOCUS,
  type CoverFocus,
} from '@/shared/lib/coverFocus';
import {
  clampHeaderBlurPercent,
  HEADER_BLUR_FRAME_SCALE,
  HEADER_BLUR_MAX_PERCENT,
  headerBlurFilter,
} from '@/shared/lib/headerPhoto';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { Button } from '@/shared/ui/Button';
import styles from './HeaderPhotoDialog.module.css';

export interface HeaderPhotoValue {
  imageId: string | null;
  focus: CoverFocus;
  blurPercent: number;
}

interface HeaderPhotoDialogProps {
  imageId: string | null;
  focus: CoverFocus;
  blurPercent: number;
  /** Ширина/высота живой шапки. Превью держит ту же пропорцию, чтобы object-position совпал. */
  aspectRatio?: number;
  onClose: () => void;
  onApply: (next: HeaderPhotoValue) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function HeaderPhotoDialog({
  imageId: savedImageId,
  focus: savedFocus,
  blurPercent: savedBlur,
  aspectRatio,
  onClose,
  onApply,
}: HeaderPhotoDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    focusX: number;
    focusY: number;
    moved: boolean;
  } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [imageId, setImageId] = useState<string | null>(savedImageId);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [focus, setFocus] = useState<CoverFocus>(savedFocus);
  const [blurPercent, setBlurPercent] = useState(() => clampHeaderBlurPercent(savedBlur));
  const [draggingFile, setDraggingFile] = useState(false);
  const [panning, setPanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalBackButton(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const hasImage = Boolean(previewUrl || imageId);
  const blurFilter = headerBlurFilter(blurPercent);
  const frameStyle = {
    objectFit: 'cover' as const,
    objectPosition: coverObjectPosition(focus),
    ...(blurFilter ? { filter: blurFilter, transform: `scale(${HEADER_BLUR_FRAME_SCALE})` } : {}),
  };
  const zoneStyle = aspectRatio && aspectRatio > 0 ? { aspectRatio } : undefined;

  const replacePreview = (next: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next;
    setPreviewUrl(next);
  };

  const takeFile = (next: File) => {
    if (!next.type.startsWith('image/')) {
      setError('Только изображения (jpg, png, webp)');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    setError(null);
    setFile(next);
    setFocus(DEFAULT_COVER_FOCUS);
    replacePreview(URL.createObjectURL(next));
  };

  const openPicker = () => {
    if (!saving) inputRef.current?.click();
  };

  const clearLocal = () => {
    setFile(null);
    replacePreview(null);
    setFocus(DEFAULT_COVER_FOCUS);
    setBlurPercent(0);
  };

  const onDelete = async () => {
    if (saving) return;
    if (!imageId && !file && !previewUrl) return;
    setSaving(true);
    setError(null);
    try {
      if (imageId) {
        await setAccountHeader({ imageId: null });
        onApply({ imageId: null, focus: DEFAULT_COVER_FOCUS, blurPercent: 0 });
      }
      setImageId(null);
      clearLocal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить фото');
    } finally {
      setSaving(false);
    }
  };

  const onConfirm = async () => {
    if (saving || !hasImage) return;
    setSaving(true);
    setError(null);
    try {
      let id = imageId;
      if (file) {
        const uploaded = await uploadFile(file);
        id = uploaded.id;
      }
      if (!id) return;
      const percent = clampHeaderBlurPercent(blurPercent);
      const nextFocus: CoverFocus = {
        x: clampCoverFocusValue(focus.x),
        y: clampCoverFocusValue(focus.y),
      };
      await setAccountHeader({
        imageId: id,
        focus: nextFocus,
        blur: percent > 0,
      });
      rememberHeaderBlurPercent(id, percent);
      onApply({ imageId: id, focus: nextFocus, blurPercent: percent });
      try {
        await saveHeaderBlurPercent(id, percent);
      } catch (e) {
        setImageId(id);
        setFile(null);
        setError(e instanceof Error ? e.message : 'Не удалось сохранить степень блюра');
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить фото');
    } finally {
      setSaving(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasImage || saving) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focusX: focus.x,
      focusY: focus.y,
      moved: false,
    };
    setPanning(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const zone = zoneRef.current;
    if (!zone) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    const rect = zone.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setFocus({
      x: clampCoverFocusValue(drag.focusX - (dx / rect.width) * 100),
      y: clampCoverFocusValue(drag.focusY - (dy / rect.height) * 100),
    });
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const setBlurFromPointer = (clientY: number) => {
    const scale = scaleRef.current;
    if (!scale || !hasImage || saving) return;
    const rect = scale.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    setBlurPercent(clampHeaderBlurPercent(ratio * HEADER_BLUR_MAX_PERCENT));
  };

  const onScalePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasImage || saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setBlurFromPointer(e.clientY);
  };

  const onScalePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setBlurFromPointer(e.clientY);
  };

  const onScaleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasImage || saving) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      setBlurPercent(p => clampHeaderBlurPercent(p + step));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setBlurPercent(p => clampHeaderBlurPercent(p - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setBlurPercent(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setBlurPercent(HEADER_BLUR_MAX_PERCENT);
    }
  };

  return createPortal(
    <div className={styles.root}>
      <div
        className={styles.backdrop}
        onClick={() => { if (!saving) onClose(); }}
      />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-photo-title"
      >
        <h2 id="header-photo-title" className={styles.title}>Фото шапки</h2>
        <div className={styles.editorRow}>
          <div
            ref={zoneRef}
            style={zoneStyle}
            className={`${styles.zone} ${hasImage ? styles.zoneFilled : ''} ${draggingFile ? styles.zoneDrag : ''} ${panning ? styles.zonePanning : ''}`}
            onClick={() => { if (!hasImage) openPicker(); }}
            onDragOver={e => { e.preventDefault(); setDraggingFile(true); }}
            onDragLeave={() => setDraggingFile(false)}
            onDrop={e => {
              e.preventDefault();
              setDraggingFile(false);
              const next = e.dataTransfer.files?.[0];
              if (next) takeFile(next);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className={styles.frame} style={frameStyle} draggable={false} />
            ) : imageId ? (
              <AuthImage
                fileId={imageId}
                fullSize
                imageFit="cover"
                alt=""
                className={styles.frame}
                style={{ ...frameStyle, background: 'transparent' }}
              />
            ) : (
              <div className={styles.placeholder}>
                <span className={styles.hint}>Нажмите или перетащите изображение</span>
                <span className={styles.sub}>JPG, PNG, WEBP · до 10 МБ</span>
              </div>
            )}
            {hasImage && !saving && (
              <>
                <div className={styles.focusHint}>Перетащите фото, чтобы выбрать кадр</div>
                <button type="button" className={styles.deleteBtn} onClick={() => void onDelete()}>
                  Удалить фото
                </button>
              </>
            )}
            {saving && <div className={styles.busy}><span className={styles.spinner} /></div>}
          </div>

          <div className={styles.blurCol}>
            <div className={styles.blurName}>Блюр</div>
            <div className={styles.blurEnd}>{HEADER_BLUR_MAX_PERCENT}%</div>
            <div
              ref={scaleRef}
              className={`${styles.blurScale} ${!hasImage ? styles.blurScaleOff : ''}`}
              role="slider"
              aria-label="Блюр"
              aria-valuemin={0}
              aria-valuemax={HEADER_BLUR_MAX_PERCENT}
              aria-valuenow={blurPercent}
              aria-valuetext={`${blurPercent}%`}
              tabIndex={hasImage && !saving ? 0 : -1}
              onPointerDown={onScalePointerDown}
              onPointerMove={onScalePointerMove}
              onKeyDown={onScaleKeyDown}
            >
              <div className={styles.blurRail}>
                <div className={styles.blurFill} style={{ height: `${(blurPercent / HEADER_BLUR_MAX_PERCENT) * 100}%` }} />
              </div>
              <div className={styles.blurThumb} style={{ bottom: `${(blurPercent / HEADER_BLUR_MAX_PERCENT) * 100}%` }}>
                <span className={styles.blurVal}>{blurPercent}%</span>
              </div>
            </div>
            <div className={styles.blurEnd}>0%</div>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button variant="secondary" className={styles.cancelBtn} fullWidth disabled={saving} onClick={onClose}>Отменить</Button>
          <Button variant="primary" fullWidth loading={saving} disabled={!hasImage} onClick={() => void onConfirm()}>
            Подтвердить
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={e => {
            const next = e.target.files?.[0];
            e.target.value = '';
            if (next) takeFile(next);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
