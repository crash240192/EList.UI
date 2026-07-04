import heroStyles from '@/shared/styles/hero.module.css';

interface HeroBackButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'frosted' | 'solid';
  'aria-label'?: string;
}

export function HeroBackButton({
  onClick,
  className,
  variant = 'frosted',
  'aria-label': ariaLabel = 'Назад',
}: HeroBackButtonProps) {
  return (
    <button
      type="button"
      className={`${heroStyles.heroBtn} ${variant === 'solid' ? heroStyles.heroBtnSolid : ''} ${className ?? ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
