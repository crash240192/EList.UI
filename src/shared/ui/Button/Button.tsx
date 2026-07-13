// shared/ui/Button/Button.tsx
// Единая кнопка приложения. Роли (variant) × размеры (size) + встроенный
// loading-стейт, который держит ширину (не даёт макету дёргаться при клике).

import React from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Показать спиннер и заблокировать кнопку, сохранив её ширину. */
  loading?: boolean;
  /** Растянуть на всю ширину контейнера. */
  fullWidth?: boolean;
  /** Иконка слева от текста. */
  leftIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, leftIcon,
    className = '', disabled, children, type = 'button', ...rest },
  ref,
) {
  // Свечение при наведении — только у акцентных ролей. Вторичные/призрачные
  // отключают глобальный hover-glow (класс объявлен в index.css).
  const noGlow = variant === 'secondary' || variant === 'ghost';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        loading ? styles.loading : '',
        noGlow ? 'noHoverGlow' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden />}
      <span className={styles.content}>
        {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
        {children}
      </span>
    </button>
  );
});
