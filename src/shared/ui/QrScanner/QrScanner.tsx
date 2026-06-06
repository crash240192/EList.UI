// shared/ui/QrScanner/QrScanner.tsx

import { useEffect, useRef, useState } from 'react';
import { parseUserIdFromText } from '@/shared/lib/userId';
import styles from './QrScanner.module.css';

interface Props {
  onDetected: (userId: string) => void;
  onClose: () => void;
}

export function QrScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const BarcodeDetectorCtor = (window as Window & {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setError('Сканер QR недоступен в этом браузере');
      return undefined;
    }

    const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setActive(true);

        const scan = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
            raf = requestAnimationFrame(() => { void scan(); });
            return;
          }

          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            const userId = raw ? parseUserIdFromText(raw) : null;
            if (userId) {
              onDetected(userId);
              return;
            }
          } catch {
            // кадр без результата — продолжаем
          }

          raf = requestAnimationFrame(() => { void scan(); });
        };

        raf = requestAnimationFrame(() => { void scan(); });
      } catch {
        if (!cancelled) setError('Не удалось открыть камеру');
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [onDetected]);

  return (
    <div className={styles.wrap}>
      <video ref={videoRef} className={styles.video} playsInline muted />
      {!active && !error && <div className={styles.hint}>Запуск камеры...</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={styles.closeBtn} onClick={onClose}>Закрыть сканер</button>
    </div>
  );
}
