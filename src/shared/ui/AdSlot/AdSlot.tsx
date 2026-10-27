// shared/ui/AdSlot/AdSlot.tsx
// Рекламный блок Яндекс РСЯ, стилизованный под карточку события.
// Документация: https://yandex.ru/support/partner2/web/products-rtb/before-start.html

import { useEffect, useRef } from 'react';
import {
  AD_PLACEHOLDER_TEXT,
  YANDEX_AD_BLOCK_ID,
  enqueueYandexAdRender,
  shouldRenderLiveAd,
} from '@/shared/lib/adConfig';
import styles from './AdSlot.module.css';

interface AdSlotProps {
  /** ID рекламного блока из кабинета РСЯ (например R-A-20290944-1) */
  blockId?: string;
  /** card — в списке событий; sidebar — в боковой панели */
  variant?: 'card' | 'sidebar';
}

let counter = 0;

export function AdSlot({ blockId = YANDEX_AD_BLOCK_ID, variant = 'card' }: AdSlotProps) {
  const idRef = useRef(`yandex_rtb_${blockId}_${++counter}`);
  const initialized = useRef(false);
  const live = shouldRenderLiveAd(blockId);

  useEffect(() => {
    if (!live || initialized.current || !blockId) return;
    initialized.current = true;
    enqueueYandexAdRender({
      blockId,
      renderTo: idRef.current,
    });
  }, [blockId, live]);

  if (!live) {
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
