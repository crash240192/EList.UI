// shared/ui/QrScanner/QrScanner.tsx

import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseUserIdFromText } from '@/shared/lib/userId';
import styles from './QrScanner.module.css';

interface Props {
  onDetected: (userId: string) => void;
  onClose: () => void;
}

export function QrScanner({ onDetected, onClose }: Props) {
  const readerId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (decodedText) => {
            const userId = parseUserIdFromText(decodedText);
            if (!userId) return;

            void scanner.stop()
              .catch(() => {})
              .finally(() => {
                if (!cancelled) onDetected(userId);
              });
          },
          () => {},
        );
        if (!cancelled) setActive(true);
      } catch {
        if (!cancelled) setError('Не удалось открыть камеру');
      }
    };

    void start();

    return () => {
      cancelled = true;
      const current = scannerRef.current;
      if (current?.isScanning) {
        void current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [readerId, onDetected]);

  return (
    <div className={styles.wrap}>
      <div id={readerId} className={styles.reader} />
      {!active && !error && <div className={styles.hint}>Запуск камеры...</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={styles.closeBtn} onClick={onClose}>Закрыть сканер</button>
    </div>
  );
}
