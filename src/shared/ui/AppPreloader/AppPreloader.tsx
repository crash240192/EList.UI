// Универсальный двойной прелоадер (тема и вариант поверх тёмного фона)
import styles from './AppPreloader.module.css';

export type AppPreloaderVariant = 'surface' | 'onDark';
export type AppPreloaderSize = 'md' | 'sm';
export type AppPreloaderLayout = 'inline' | 'block';

interface AppPreloaderProps {
  variant?: AppPreloaderVariant;
  size?: AppPreloaderSize;
  layout?: AppPreloaderLayout;
  className?: string;
  /** Только при role="status" — для скринридеров */
  'aria-label'?: string;
  /** status — регион загрузки; presentation/none — декоративно внутри aria-hidden родителя */
  role?: 'status' | 'presentation' | 'none';
}

export function AppPreloader({
  variant = 'surface',
  size = 'md',
  layout = 'inline',
  className,
  'aria-label': ariaLabel = 'Загрузка',
  role = 'status',
}: AppPreloaderProps) {
  const ring = variant === 'onDark' ? styles.ringOnDark : styles.ringSurface;
  const ringInner = variant === 'onDark' ? styles.ringInnerOnDark : styles.ringInnerSurface;
  const sizeCls = size === 'sm' ? styles.sizeSm : styles.sizeMd;
  const layoutCls =
    layout === 'block' ? `${styles.wrap} ${styles.wrapBlock}` : `${styles.wrap} ${styles.wrapInline}`;

  const wrapProps =
    role === 'status'
      ? { role: 'status' as const, 'aria-label': ariaLabel }
      : role === 'presentation'
        ? { role: 'presentation' as const, 'aria-hidden': true as const }
        : { 'aria-hidden': true as const };

  return (
    <div className={`${layoutCls} ${className ?? ''}`} {...wrapProps}>
      <div className={`${styles.rings} ${sizeCls}`} aria-hidden>
        <div className={`${styles.ring} ${ring}`} />
        <div className={`${styles.ringInner} ${ringInner}`} />
      </div>
    </div>
  );
}
