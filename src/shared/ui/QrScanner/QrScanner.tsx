// shared/ui/QrScanner/QrScanner.tsx

import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import styles from './QrScanner.module.css';

interface Props {
  onDetected: (value: string) => void;
  onClose: () => void;
  /** Normalize/validate decoded text; return null to keep scanning. Default: trim non-empty. */
  parse?: (decodedText: string) => string | null;
}

export function QrScanner({ onDetected, onClose, parse }: Props) {
  const readerId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;

    const resolve = (decodedText: string): string | null => {
      if (parse) return parse(decodedText);
      const trimmed = decodedText.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (decodedText) => {
            const value = resolve(decodedText);
            if (!value) return;

            void scanner.stop()
              .catch(() => {})
              .finally(() => {
                if (!cancelled) onDetected(value);
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
  }, [readerId, onDetected, parse]);

  return (
    <div className={styles.wrap}>
      <div id={readerId} className={styles.reader} />
      {!active && !error && <div className={styles.hint}>Запуск камеры...</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={styles.closeBtn} onClick={onClose}>Закрыть сканер</button>
    </div>
  );
}
