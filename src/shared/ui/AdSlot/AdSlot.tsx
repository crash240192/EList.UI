// shared/ui/AdSlot/AdSlot.tsx
// Рекламный блок Яндекс РСЯ, стилизованный под карточку события.
// Документация: https://yandex.ru/support/partner2/web/products-rtb/before-start.html

import { useEffect, useRef, useState } from 'react';
import {
  AD_PLACEHOLDER_TEXT,
  shouldRenderLiveAd,
  isYandexAdsScriptReady,
} from '@/shared/lib/adConfig';
import styles from './AdSlot.module.css';

interface AdSlotProps {
  /** ID рекламного блока из кабинета РСЯ (число) */
  blockId?: string;
  /** card — в списке событий; sidebar — в боковой панели */
  variant?: 'card' | 'sidebar';
}

let counter = 0;

export function AdSlot({ blockId, variant = 'card' }: AdSlotProps) {
  const idRef       = useRef(`yandex_rtb_${++counter}`);
  const initialized = useRef(false);
  const [liveReady, setLiveReady] = useState(() => shouldRenderLiveAd(blockId));

  useEffect(() => {
    if (liveReady) return;
    const timer = window.setTimeout(() => {
      if (isYandexAdsScriptReady()) setLiveReady(shouldRenderLiveAd(blockId));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [blockId, liveReady]);

  useEffect(() => {
    if (!liveReady || initialized.current || !blockId) return;
    initialized.current = true;

    const id = idRef.current;

    const tryInit = () => {
      const win = window as Window & { Ya?: { Context?: { AdvManager?: { render: (opts: object) => void } } } };
      if (!win.Ya?.Context?.AdvManager) return;

      win.Ya.Context.AdvManager.render({
        blockId,
        renderTo: id,
        async: true,
      });
    };

    tryInit();
    const timer = window.setTimeout(tryInit, 1000);
    return () => window.clearTimeout(timer);
  }, [blockId, liveReady]);

  if (!liveReady) {
    if (variant === 'sidebar') {
      return (
        <div className={styles.sidebarWrap} aria-label="Рекламное место">
          <span className={styles.label}>Реклама</span>
          <p className={styles.sidebarText}>{AD_PLACEHOLDER_TEXT}</p>
        </div>
      );
    }

    return (
      <div className={styles.wrap} aria-label="Рекламное место">
        <span className={styles.label}>Реклама</span>
        <div className={styles.placeholder}>
          <div className={styles.placeholderCover} />
          <div className={styles.placeholderBody}>
            <p className={styles.placeholderText}>{AD_PLACEHOLDER_TEXT}</p>
            <div className={styles.placeholderLine} style={{ width: '55%' }} />
            <div className={styles.placeholderLine} style={{ width: '38%', height: 10 }} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={styles.sidebarWrap}>
        <span className={styles.label}>Реклама</span>
        <div id={idRef.current} className={styles.sidebarInner} />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Реклама</span>
      <div id={idRef.current} className={styles.inner} />
    </div>
  );
}
