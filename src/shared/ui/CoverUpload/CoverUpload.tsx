// shared/ui/CoverUpload/CoverUpload.tsx
// Загрузка обложки мероприятия — прямоугольная зона с drag-and-drop

import { useRef, useState } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import styles from './CoverUpload.module.css';

interface CoverUploadProps {
  currentUrl?: string | null;
  onUploaded: (url: string, fileId: string) => void;
}

export function CoverUpload({ currentUrl, onUploaded }: CoverUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Только изображения (jpg, png, webp)'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Файл слишком большой (макс. 10 МБ)'); return;
    }

    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true); setError(null);
    try {
      const result = await uploadFile(file);
      onUploaded(result.url, result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setPreview(currentUrl ?? null);
    } finally { setLoading(false); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''} ${preview ? styles.hasImage : ''}`}
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {preview ? (
        <img src={preview} alt="Обложка" className={styles.preview} />
      ) : (
        <div className={styles.placeholder}>
          <span className={styles.icon}>🖼️</span>
          <span className={styles.hint}>Нажмите или перетащите изображение</span>
          <span className={styles.sub}>JPG, PNG, WEBP · до 10 МБ</span>
        </div>
      )}

      <div className={styles.overlay}>
        {loading
          ? <span className={styles.spinner} />
          : preview
            ? <span className={styles.changeHint}>Сменить обложку</span>
            : null}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <input
        ref={inputRef} type="file" accept="image/*" className={styles.hiddenInput}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
