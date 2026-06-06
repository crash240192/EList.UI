// shared/ui/QrCode/QrCodeImage.tsx

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import styles from './QrCodeImage.module.css';

interface Props {
  value: string;
  size?: number;
  alt?: string;
}

export function QrCodeImage({ value, size = 220, alt = 'QR-код' }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setError('Не удалось создать QR-код'); });

    return () => { cancelled = true; };
  }, [value, size]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!src) return <div className={styles.skeleton} style={{ width: size, height: size }} />;

  return <img src={src} width={size} height={size} alt={alt} className={styles.image} />;
}
