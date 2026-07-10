// shared/ui/AuthImage/AuthImage.tsx
// <img> с авторизационными заголовками.
// Глобальный кэш blob-URL — файл загружается только один раз за сессию.
// Режим fullSize: превью → размытое превью + прелоадер → полный размер

import { useEffect, useState } from 'react';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import styles from './AuthImage.module.css';

const DEFAULT_PRELOADER_DELAY_MS = 300;

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

/** Предзагрузка в кэш (соседние кадры в лайтбоксе) */
export function prefetchAuthImage(fileId: string, fullSize = true): void {
  if (!fileId) return;
  const key = cacheKey(fileId, fullSize);
  if (blobCache.has(key)) return;
  void getOrFetchBlob(fileId, fullSize).catch(() => {});
  if (fullSize) {
    const thumbKey = cacheKey(fileId, false);
    if (!blobCache.has(thumbKey)) {
      void getOrFetchBlob(fileId, false).catch(() => {});
    }
  }
}

function useDelayedVisible(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
}

function ImagePreloader() {
  return (
    <div className={styles.preloaderSlot} aria-hidden>
      <AppPreloader variant="onDark" role="presentation" layout="inline" />
    </div>
  );
}

interface AuthImageProps {
  fileId:    string;
  /** Запрос полноразмерного файла (заголовок FullSize); иначе — превью с API */
  fullSize?: boolean;
  /** object-fit для слоёв в режиме fullSize (превью и полный кадр) */
  imageFit?: 'contain' | 'cover';
  /** Показывать прелоадер только если загрузка дольше этого порога (мс) */
  preloaderDelayMs?: number;
  alt?:      string;
  className?: string;
  style?:    React.CSSProperties;
  fallback?: React.ReactNode;
  onLoad?:   React.ReactEventHandler<HTMLImageElement>;
  onError?:  () => void;
}

/** Один запрос по пропу fullSize (без поэтапной подгрузки превью + полного) */
function AuthImageSingle({
  fileId,
  fullSize = false,
  preloaderDelayMs = DEFAULT_PRELOADER_DELAY_MS,
  alt,
  className,
  style,
  fallback,
  onLoad,
  onError: onErrorProp,
}: AuthImageProps) {
  const key = cacheKey(fileId, fullSize);
  const [src, setSrc] = useState<string | null>(() => blobCache.get(key) ?? null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(() => !blobCache.has(key));
  const showPreloader = useDelayedVisible(loading && !src && !error, preloaderDelayMs);

  useEffect(() => {
    if (!fileId) return;
    const k = cacheKey(fileId, fullSize);
    setError(false);
    if (blobCache.has(k)) {
      setSrc(blobCache.get(k)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    getOrFetchBlob(fileId, fullSize)
      .then(url => {
        if (!cancelled) {
          setSrc(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
          onErrorProp?.();
        }
      });
    return () => { cancelled = true; };
  }, [fileId, fullSize]);

  if (error) return <>{fallback ?? null}</>;
  if (!src) {
    return showPreloader ? <ImagePreloader /> : <>{fallback ?? null}</>;
  }
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
  preloaderDelayMs = DEFAULT_PRELOADER_DELAY_MS,
}: AuthImageProps) {
  const kFull = cacheKey(fileId, true);
  const kThumb = cacheKey(fileId, false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => blobCache.get(kThumb) ?? null);
  const [fullUrl, setFullUrl] = useState<string | null>(() => blobCache.get(kFull) ?? null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(() => !blobCache.has(kFull));

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setError(false);

    const fullKey = cacheKey(fileId, true);
    const thumbKey = cacheKey(fileId, false);

    if (blobCache.has(fullKey)) {
      setFullUrl(blobCache.get(fullKey)!);
      setPreviewUrl(blobCache.get(thumbKey) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPreviewUrl(blobCache.get(thumbKey) ?? null);
    setFullUrl(null);

    void (async () => {
      try {
        if (!blobCache.has(thumbKey)) {
          try {
            const thumb = await getOrFetchBlob(fileId, false);
            if (cancelled) return;
            setPreviewUrl(thumb);
          } catch {
            // превью недоступно
          }
        }

        if (cancelled) return;

        const full = await getOrFetchBlob(fileId, true);
        if (cancelled) return;
        setFullUrl(full);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
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

  const needsPreloader = loading && !fullUrl && !(error && previewUrl);
  const showPreloader = useDelayedVisible(needsPreloader, preloaderDelayMs);
  const showBlurredPreview = !!previewUrl && !fullUrl;
  const showInstantFull = !!fullUrl && blobCache.has(cacheKey(fileId, true));

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
          className={showInstantFull ? styles.fullLayerInstant : styles.fullLayer}
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
