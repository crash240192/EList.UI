import type { ReactNode } from 'react';
import { AccessDeniedStamp, type AccessDeniedStampSize } from './AccessDeniedStamp';
import styles from './AccessDeniedGate.module.css';

export type AccessDeniedGateVariant = 'section' | 'page';

interface AccessDeniedGateProps {
  /** Контент блока (при отказе размывается) */
  children: ReactNode;
  denied: boolean;
  variant?: AccessDeniedGateVariant;
  className?: string;
}

export function AccessDeniedGate({
  children,
  denied,
  variant = 'section',
  className,
}: AccessDeniedGateProps) {
  const stampSize: AccessDeniedStampSize = variant === 'page' ? 'lg' : 'sm';
  const variantClass = variant === 'page' ? styles.gatePage : styles.gateSection;

  return (
    <div className={`${styles.gate} ${variantClass} ${className ?? ''}`}>
      <div className={`${styles.content} ${denied ? styles.contentBlurred : ''}`}>{children}</div>
      {denied && (
        <div className={styles.overlay} role="status" aria-live="polite" aria-label="Доступ запрещён">
          <AccessDeniedStamp size={stampSize} />
        </div>
      )}
    </div>
  );
}
