// shared/ui/AdSlot/AdSlot.tsx
// Рекламный блок Яндекс РСЯ, стилизованный под карточку события.
// Документация: https://yandex.ru/support/partner2/web/products-rtb/before-start.html

import { useEffect, useRef } from 'react';
import styles from './AdSlot.module.css';

interface AdSlotProps {
  /** ID рекламного блока из кабинета РСЯ (число) */
  blockId: string;
}

let counter = 0;

export function AdSlot({ blockId }: AdSlotProps) {
  const idRef      = useRef(`yandex_rtb_${++counter}`);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !blockId) return;
    initialized.current = true;

    const id = idRef.current;

    // РСЯ требует чтобы div с нужным id уже был в DOM до вызова Ya.Context.AdvManager
    const tryInit = () => {
      const win = window as any;
      if (!win.Ya?.Context?.AdvManager) return; // скрипт ещё не загружен

      win.Ya.Context.AdvManager.render({
        blockId,
        renderTo: id,
        async: true,
      });
    };

    // Пробуем сразу, потом ещё раз через 1с если скрипт не успел загрузиться
    tryInit();
    const timer = setTimeout(tryInit, 1000);
    return () => clearTimeout(timer);
  }, [blockId]);

  if (!blockId) {
    // Заглушка — показываем как выглядит рекламное место
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>Реклама</span>
        <div className={styles.placeholder}>
          <div className={styles.placeholderImg} />
          <div className={styles.placeholderBody}>
            <div className={styles.placeholderLine} style={{ width: '70%' }} />
            <div className={styles.placeholderLine} style={{ width: '50%' }} />
            <div className={styles.placeholderLine} style={{ width: '40%', height: 10 }} />
          </div>
        </div>
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
