// shared/ui/AuthImage/AuthImage.tsx
// <img> с авторизационными заголовками.
// Глобальный кэш blob-URL — файл загружается только один раз за сессию.

import { useEffect, useState } from 'react';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';

function cacheKey(fileId: string, fullSize: boolean): string {
  return `${fileId}\0${fullSize ? 'full' : 'thumb'}`;
}

// Глобальный кэш: (fileId + режим) → blob URL (живёт всю сессию)
const blobCache = new Map<string, string>();
// Промисы in-flight: не делаем два одинаковых запроса одновременно
const inFlight  = new Map<string, Promise<string>>();

async function getOrFetchBlob(fileId: string, fullSize: boolean): Promise<string> {
  const key = cacheKey(fileId, fullSize);
  if (blobCache.has(key)) return blobCache.get(key)!;
  if (!inFlight.has(key)) {
    const p = fetchAuthedImage(fileId, { fullSize })
      .then(url => { blobCache.set(key, url); inFlight.delete(key); return url; })
      .catch(err => { inFlight.delete(key); throw err; });
    inFlight.set(key, p);
  }
  return inFlight.get(key)!;
}

interface AuthImageProps {
  fileId:    string;
  /** Запрос полноразмерного файла (заголовок FullSize); иначе — превью с API */
  fullSize?: boolean;
  alt?:      string;
  className?: string;
  style?:    React.CSSProperties;
  fallback?: React.ReactNode;
  onLoad?:   () => void;
  onError?:  () => void;
}

export function AuthImage({
  fileId,
  fullSize = false,
  alt = '',
  className,
  style,
  fallback,
  onLoad,
  onError: onErrorProp,
}: AuthImageProps) {
  const key = cacheKey(fileId, fullSize);
  const [src,   setSrc]   = useState<string | null>(() => blobCache.get(key) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    const k = cacheKey(fileId, fullSize);
    setError(false);
    if (blobCache.has(k)) {
      setSrc(blobCache.get(k)!);
      return;
    }
    setSrc(null);
    let cancelled = false;
    getOrFetchBlob(fileId, fullSize)
      .then(url => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          onErrorProp?.();
        }
      });
    return () => { cancelled = true; };
  }, [fileId, fullSize]);

  if (error || !src) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} style={style} onLoad={onLoad} />;
}
