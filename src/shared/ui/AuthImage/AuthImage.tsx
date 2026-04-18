// shared/ui/AuthImage/AuthImage.tsx
// <img> с авторизационными заголовками.
// Глобальный кэш blob-URL — файл загружается только один раз за сессию.

import { useEffect, useState } from 'react';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';

// Глобальный кэш: fileId → blob URL (живёт всю сессию)
const blobCache = new Map<string, string>();
// Промисы in-flight: не делаем два запроса к одному fileId одновременно
const inFlight  = new Map<string, Promise<string>>();

async function getOrFetchBlob(fileId: string): Promise<string> {
  if (blobCache.has(fileId)) return blobCache.get(fileId)!;

  if (!inFlight.has(fileId)) {
    const promise = fetchAuthedImage(fileId).then(url => {
      blobCache.set(fileId, url);
      inFlight.delete(fileId);
      return url;
    });
    inFlight.set(fileId, promise);
  }

  return inFlight.get(fileId)!;
}

interface AuthImageProps {
  fileId:    string;
  alt?:      string;
  className?: string;
  style?:    React.CSSProperties;
  fallback?: React.ReactNode;
}

export function AuthImage({ fileId, alt = '', className, style, fallback }: AuthImageProps) {
  const [src,   setSrc]   = useState<string | null>(() => blobCache.get(fileId) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    // Если уже в кэше — ничего не делаем
    if (blobCache.has(fileId)) {
      setSrc(blobCache.get(fileId)!);
      return;
    }
    setError(false);
    getOrFetchBlob(fileId)
      .then(url => setSrc(url))
      .catch(() => setError(true));
  }, [fileId]);

  if (error || !src) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} style={style} />;
}
