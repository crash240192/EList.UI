// shared/ui/AuthImage/AuthImage.tsx
// <img> с авторизационными заголовками.
// Глобальный кэш blob-URL — файл загружается только один раз за сессию.
// Режим fullSize: превью → размытое превью + прелоадер → полный размер

import { useEffect, useState } from 'react';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';
import styles from './AuthImage.module.css';

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

function ImagePreloader() {
  return (
    <div className={styles.preloaderSlot} aria-hidden>
      <div className={styles.preloader} role="presentation">
        <div className={styles.preloaderRing} />
        <div className={styles.preloaderRingInner} />
      </div>
    </div>
  );
}

interface AuthImageProps {
  fileId:    string;
  /** Запрос полноразмерного файла (заголовок FullSize); иначе — превью с API */
  fullSize?: boolean;
  /** object-fit для слоёв в режиме fullSize (превью и полный кадр) */
  imageFit?: 'contain' | 'cover';
  alt?:      string;
  className?: string;
  style?:    React.CSSProperties;
  fallback?: React.ReactNode;
  onLoad?:   () => void;
  onError?:  () => void;
}

/** Один запрос по пропу fullSize (без поэтапной подгрузки превью + полного) */
function AuthImageSingle({
  fileId,
  fullSize = false,
  alt,
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

/**
 * Полноразмерно: 1) чёрный фон + прелоадер (превью грузится) → 2) размытое превью + прелоадер (полный грузится) → 3) полный кадр
 */
function AuthImageProgressiveFull({
  fileId,
  alt,
  className,
  style,
  fallback,
  onLoad,
  onError: onErrorProp,
  imageFit = 'contain',
}: AuthImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl]       = useState<string | null>(null);
  const [error, setError]           = useState(false);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setError(false);
    setPreviewUrl(null);
    setFullUrl(null);

    const kFull = cacheKey(fileId, true);
    if (blobCache.has(kFull)) {
      setFullUrl(blobCache.get(kFull)!);
      return;
    }

    void (async () => {
      try {
        try {
          const thumb = await getOrFetchBlob(fileId, false);
          if (cancelled) return;
          setPreviewUrl(thumb);
        } catch {
          // превью недоступно — этап 1 до прихода полного файла
        }

        if (cancelled) return;

        const full = await getOrFetchBlob(fileId, true);
        if (cancelled) return;
        setFullUrl(full);
      } catch {
        if (!cancelled) {
          setError(true);
          onErrorProp?.();
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileId]);

  const layerFitStyle: React.CSSProperties =
    imageFit === 'cover'
      ? { objectFit: 'cover', width: '100%', height: '100%', maxHeight: 'none' }
      : { objectFit: 'contain' };

  const showPreloader = !fullUrl && !(error && previewUrl);
  const showBlurredPreview = !!previewUrl && !fullUrl;

  if (error && !previewUrl && !fullUrl) return <>{fallback ?? null}</>;

  return (
    <div className={`${styles.fullSizeRoot} ${className ?? ''}`} style={style}>
      {showBlurredPreview && (
        <>
          <img src={previewUrl!} alt="" className={styles.previewLayer} style={layerFitStyle} aria-hidden />
          <div className={styles.previewDim} aria-hidden />
        </>
      )}

      {showPreloader && <ImagePreloader />}

      {fullUrl && (
        <img
          src={fullUrl}
          alt={alt}
          className={styles.fullLayer}
          style={layerFitStyle}
          onLoad={onLoad}
          onError={() => {
            setError(true);
            onErrorProp?.();
          }}
        />
      )}
    </div>
  );
}

export function AuthImage(props: AuthImageProps) {
  if (props.fullSize) return <AuthImageProgressiveFull {...props} />;
  return <AuthImageSingle {...props} />;
}
