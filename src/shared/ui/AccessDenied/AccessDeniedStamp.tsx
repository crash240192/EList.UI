import { useId } from 'react';
import styles from './AccessDeniedStamp.module.css';

export type AccessDeniedStampSize = 'sm' | 'md' | 'lg';

/** Насыщенный красный «краска» — без прозрачности */
const STAMP_RED = '#e53935';

interface AccessDeniedStampProps {
  size?: AccessDeniedStampSize;
  className?: string;
}

/** Потёртости трафаретной краски: выбивание «дырок», неровные края — не зернистый шум */
function StencilGrungeFilter({ id }: { id: string }) {
  return (
    <filter
      id={id}
      x="-6%"
      y="-6%"
      width="112%"
      height="112%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.07 0.05"
        numOctaves="3"
        seed="6"
        result="edgeNoise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="edgeNoise"
        scale="3"
        xChannelSelector="R"
        yChannelSelector="G"
        result="roughened"
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.35 0.28"
        numOctaves="4"
        seed="19"
        result="chipNoise"
      />
      <feColorMatrix
        in="chipNoise"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 14 -6"
        result="chips"
      />
      <feComposite in="roughened" in2="chips" operator="out" />
    </filter>
  );
}

export function AccessDeniedStamp({ size = 'md', className }: AccessDeniedStampProps) {
  const uid = useId().replace(/:/g, '');
  const grungeId = `stampStencil-${uid}`;
  const wrapClass = size === 'sm' ? styles.wrap_sm : size === 'lg' ? styles.wrap_lg : styles.wrap_md;

  return (
    <div className={`${styles.wrap} ${wrapClass} ${className ?? ''}`} role="img" aria-label="Доступ запрещён">
      <svg
        className={styles.svg}
        viewBox="0 0 420 128"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <StencilGrungeFilter id={grungeId} />
        </defs>

        {/* Красная «краска»: рамка, круг, текст — с потёртостями */}
        <g fill={STAMP_RED} stroke={STAMP_RED} filter={`url(#${grungeId})`}>
          <rect
            x="5"
            y="5"
            width="410"
            height="118"
            rx="14"
            ry="14"
            fill="none"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <circle cx="62" cy="64" r="34" fill={STAMP_RED} stroke="none" />
          <text
            x="118"
            y="50"
            fill={STAMP_RED}
            stroke="none"
            fontSize="46"
            fontWeight="900"
            fontFamily="Impact, Haettenschweiler, 'Arial Black', sans-serif"
            letterSpacing="3"
          >
            ACCESS
          </text>
          <text
            x="118"
            y="106"
            fill={STAMP_RED}
            stroke="none"
            fontSize="46"
            fontWeight="900"
            fontFamily="Impact, Haettenschweiler, 'Arial Black', sans-serif"
            letterSpacing="3"
          >
            DENIED
          </text>
        </g>

        {/* Белая полоса знака — поверх красного, без «дырок» */}
        <rect x="38" y="58" width="48" height="12" rx="1" fill="#ffffff" />
      </svg>
    </div>
  );
}
