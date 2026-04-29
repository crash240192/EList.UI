// shared/ui/AuthImage/AuthImage.tsx
import { useEffect, useRef, useState } from 'react';
import { fetchAuthedImage } from '@/shared/api/fileStorageClient';

const blobCache = new Map<string, string>();
const inFlight  = new Map<string, Promise<string>>();

// Лимит: не более 2 параллельных загрузок изображений
const MAX_IMG = 2;
let imgActive = 0;
const imgQueue: Array<() => void> = [];

async function withImgLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (imgActive >= MAX_IMG) {
    await new Promise<void>(r => imgQueue.push(r));
  }
  imgActive++;
  try { return await fn(); }
  finally { imgActive--; imgQueue.shift()?.(); }
}

async function getOrFetchBlob(fileId: string): Promise<string> {
  if (blobCache.has(fileId)) return blobCache.get(fileId)!;
  if (!inFlight.has(fileId)) {
    const p = withImgLimit(() => fetchAuthedImage(fileId))
      .then(url => { blobCache.set(fileId, url); inFlight.delete(fileId); return url; })
      .catch(err => { inFlight.delete(fileId); throw err; });
    inFlight.set(fileId, p);
  }
  return inFlight.get(fileId)!;
}

interface AuthImageProps {
  fileId: string; alt?: string; className?: string;
  style?: React.CSSProperties; fallback?: React.ReactNode;
  onLoad?: () => void; onError?: () => void;
}

export function AuthImage({ fileId, alt = '', className, style, fallback, onLoad, onError: onErrorProp }: AuthImageProps) {
  const [src,   setSrc]   = useState<string | null>(() => blobCache.get(fileId) ?? null);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!fileId) return;
    if (blobCache.has(fileId)) { setSrc(blobCache.get(fileId)!); return; }
    setError(false);
    getOrFetchBlob(fileId)
      .then(url => { if (mounted.current) setSrc(url); })
      .catch(() => { if (mounted.current) { setError(true); onErrorProp?.(); } });
  }, [fileId]);

  if (error || !src) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} style={style} onLoad={onLoad} />;
}
