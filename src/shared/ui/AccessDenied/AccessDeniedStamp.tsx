import { useId, type CSSProperties } from 'react';
import styles from './AccessDeniedStamp.module.css';

export type AccessDeniedStampSize = 'sm' | 'md' | 'lg';

/** Белый «краска по трафарету» — 50% непрозрачности */
const STAMP_WHITE = 'rgba(255, 255, 255, 0.5)';
const STAMP_RED = '#dc2626';

interface AccessDeniedStampProps {
  size?: AccessDeniedStampSize;
  className?: string;
}

function GrungeFilters({ grungeId, inkId }: { grungeId: string; inkId: string }) {
  return (
    <svg className={styles.filterSvg} aria-hidden width="0" height="0">
      <defs>
        <filter id={grungeId} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75 0.45" numOctaves="4" seed="8" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono" result="speckle">
            <feFuncA type="discrete" tableValues="0 0.35 0.55 0.72 0.88 1" />
          </feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="speckle" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={inkId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2 0.9" numOctaves="3" seed="3" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="gn" />
          <feBlend in="SourceGraphic" in2="gn" mode="multiply" />
        </filter>
      </defs>
    </svg>
  );
}

export function AccessDeniedStamp({ size = 'md', className }: AccessDeniedStampProps) {
  const uid = useId().replace(/:/g, '');
  const grungeId = `accessDeniedGrunge-${uid}`;
  const inkId = `accessDeniedInk-${uid}`;
  const sizeClass = size === 'sm' ? styles.stamp_sm : size === 'lg' ? styles.stamp_lg : styles.stamp_md;

  return (
    <>
      <GrungeFilters grungeId={grungeId} inkId={inkId} />
      <div
        className={`${styles.stamp} ${sizeClass} ${className ?? ''}`}
        style={
          {
            '--stamp-grunge-filter': `url(#${grungeId})`,
            '--stamp-ink-filter': `url(#${inkId})`,
          } as React.CSSProperties
        }
        role="img"
        aria-label="Доступ запрещён"
      >
        <svg className={styles.icon} viewBox="0 0 48 48" fill="none" aria-hidden>
          <circle cx="24" cy="24" r="20" fill={STAMP_RED} />
          <rect x="10" y="21" width="28" height="6" rx="0.5" fill={STAMP_WHITE} />
        </svg>
        <div className={styles.text}>
          <span className={styles.line}>ACCESS</span>
          <span className={styles.line}>DENIED</span>
        </div>
      </div>
    </>
  );
}
