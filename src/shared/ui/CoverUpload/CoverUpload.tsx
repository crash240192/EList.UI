// shared/ui/CoverUpload/CoverUpload.tsx
// Загрузка обложки мероприятия — прямоугольная зона с drag-and-drop и фокусом кадра

import { useRef, useState, useEffect } from 'react';
import { isFileStorageDownloadUrl, uploadFile } from '@/shared/api/fileStorageClient';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import {
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  DEFAULT_COVER_FOCUS,
  coverFocusImgStyle,
  coverZoomOf,
  formatCoverZoom,
  normalizeCoverFocus,
  panCoverFocus,
  type CoverFocus,
} from '@/shared/lib/coverFocus';
import styles from './CoverUpload.module.css';

interface CoverUploadProps {
  currentUrl?: string | null;
  /** Id файла в file storage (при редактировании без публичного URL) */
  currentFileId?: string | null;
  focus?: CoverFocus;
  onUploaded: (url: string, fileId: string) => void;
  onFocusChange?: (focus: CoverFocus) => void;
}

export function CoverUpload({
  currentUrl,
  currentFileId,
  focus = DEFAULT_COVER_FOCUS,
  onUploaded,
  onFocusChange,
}: CoverUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    focus: CoverFocus;
    moved: boolean;
  } | null>(null);
  const natRef = useRef({ w: 0, h: 0 });
  const [preview, setPreview] = useState<string | null>(() =>
    currentUrl && !isFileStorageDownloadUrl(currentUrl) ? currentUrl : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    if (!currentUrl && !currentFileId) {
      setPreview(null);
      return;
    }
    if (currentUrl && !isFileStorageDownloadUrl(currentUrl)) {
      setPreview(currentUrl);
    }
  }, [currentUrl, currentFileId]);

  const displayUrl = preview && !isFileStorageDownloadUrl(preview) ? preview : null;
  const hasStoredCover = !!(displayUrl || currentFileId);
  const frameStyle = coverFocusImgStyle(focus);
  const zoom = coverZoomOf(focus);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const onWheel = (e: WheelEvent) => {
      if (!hasStoredCover || loading || !onFocusChange) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      onFocusChange(normalizeCoverFocus({
        ...focus,
        zoom: coverZoomOf(focus) + step,
      }));
    };
    zone.addEventListener('wheel', onWheel, { passive: false });
    return () => zone.removeEventListener('wheel', onWheel);
  }, [hasStoredCover, loading, onFocusChange, focus]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Только изображения (jpg, png, webp)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Файл слишком большой (макс. 10 МБ)');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    setError(null);
    natRef.current = { w: 0, h: 0 };
    try {
      const result = await uploadFile(file);
      onFocusChange?.(DEFAULT_COVER_FOCUS);
      onUploaded(result.url, result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setPreview(currentUrl && !isFileStorageDownloadUrl(currentUrl) ? currentUrl : null);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const openPicker = () => {
    if (!loading) inputRef.current?.click();
  };

  const rememberNat = (e: React.SyntheticEvent<HTMLImageElement>) => {
    natRef.current = {
      w: e.currentTarget.naturalWidth,
      h: e.currentTarget.naturalHeight,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasStoredCover || loading || !onFocusChange) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const zone = zoneRef.current;
    if (!zone) return;
    zone.setPointerCapture(e.pointerId);
    const drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focus,
      moved: false,
    };
    dragRef.current = drag;
    setPanning(true);
    const apply = onFocusChange;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
      const rect = zone.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      apply(panCoverFocus(
        drag.focus,
        dx,
        dy,
        rect.width,
        rect.height,
        natRef.current.w,
        natRef.current.h,
      ));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (dragRef.current?.pointerId === drag.pointerId) dragRef.current = null;
      setPanning(false);
      try { zone.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
      if (!drag.moved && !hasStoredCover) openPicker();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onZoneClick = () => {
    if (!hasStoredCover) openPicker();
  };

  return (
    <div className={styles.wrap}>
    <div
      ref={zoneRef}
      className={`${styles.zone} ${dragging ? styles.dragging : ''} ${hasStoredCover ? styles.hasImage : ''} ${panning ? styles.panning : ''} ${loading ? styles.loading : ''}`}
      onClick={onZoneClick}
      onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          alt="Обложка"
          className={styles.preview}
          style={frameStyle}
          draggable={false}
          onLoad={rememberNat}
        />
      ) : currentFileId ? (
        <AuthImage
          fileId={currentFileId}
          alt="Обложка"
          className={styles.preview}
          imageFit="cover"
          style={{ width: '100%', height: '100%', ...frameStyle, display: 'block' }}
          onLoad={rememberNat}
        />
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.hint}>Нажмите или перетащите изображение</span>
          <span className={styles.sub}>JPG, PNG, WEBP · до 10 МБ</span>
        </div>
      )}

      {hasStoredCover && !loading && (
        <>
          <div className={styles.focusHint}>
            {zoom > 1 ? 'Сдвиньте кадр в любую сторону' : 'Перетащите фото, чтобы выбрать кадр'}
          </div>
          <button
            type="button"
            className={styles.changeHint}
            onClick={e => {
              e.stopPropagation();
              openPicker();
            }}
          >
            Сменить
          </button>
        </>
      )}

      <div className={styles.overlay}>
        {loading ? <span className={styles.spinner} /> : null}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={e => e.target.files?.[0] && void handleFile(e.target.files[0])}
      />
    </div>
    <div className={`${styles.zoomRow} ${!hasStoredCover ? styles.zoomOff : ''}`}>
      <span className={styles.zoomLabel} id="cover-zoom-label">Масштаб</span>
      <input
        className={styles.zoomRange}
        type="range"
        min={COVER_ZOOM_MIN}
        max={COVER_ZOOM_MAX}
        step={0.01}
        value={zoom}
        disabled={!hasStoredCover || loading || !onFocusChange}
        aria-labelledby="cover-zoom-label"
        aria-valuetext={formatCoverZoom(zoom)}
        onChange={e => {
          onFocusChange?.(normalizeCoverFocus({ ...focus, zoom: Number(e.target.value) }));
        }}
      />
      <span className={styles.zoomValue}>{formatCoverZoom(zoom)}</span>
    </div>
    </div>
  );
}
