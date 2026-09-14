// shared/ui/CoverUpload/CoverUpload.tsx
// Загрузка обложки мероприятия — прямоугольная зона с drag-and-drop и фокусом кадра

import { useRef, useState, useEffect } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import {
  DEFAULT_COVER_FOCUS,
  clampCoverFocusValue,
  coverObjectPosition,
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
    focusX: number;
    focusY: number;
    moved: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    if (currentUrl) setPreview(currentUrl);
  }, [currentUrl]);

  const hasStoredCover = !!(preview || currentFileId);
  const objectPosition = coverObjectPosition(focus);

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
    try {
      const result = await uploadFile(file);
      onFocusChange?.(DEFAULT_COVER_FOCUS);
      onUploaded(result.url, result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setPreview(currentUrl ?? null);
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

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasStoredCover || loading || !onFocusChange) return;
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
    if (!drag || drag.pointerId !== e.pointerId || !onFocusChange) return;
    const zone = zoneRef.current;
    if (!zone) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    const rect = zone.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const next: CoverFocus = {
      x: clampCoverFocusValue(drag.focusX - (dx / rect.width) * 100),
      y: clampCoverFocusValue(drag.focusY - (dy / rect.height) * 100),
    };
    onFocusChange(next);
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
    if (!drag.moved && !hasStoredCover) openPicker();
  };

  const onZoneClick = () => {
    if (!hasStoredCover) openPicker();
  };

  return (
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
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      {preview ? (
        <img
          src={preview}
          alt="Обложка"
          className={styles.preview}
          style={{ objectPosition }}
          draggable={false}
        />
      ) : currentFileId ? (
        <AuthImage
          fileId={currentFileId}
          alt="Обложка"
          className={styles.preview}
          imageFit="cover"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }}
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
            Перетащите фото, чтобы выбрать кадр
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
  );
}
