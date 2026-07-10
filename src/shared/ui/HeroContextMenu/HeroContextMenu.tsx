import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './HeroContextMenu.module.css';

interface HeroContextMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  'aria-label'?: string;
  zIndexBase?: number;
}

export function HeroContextMenu({
  open,
  onClose,
  anchorRef,
  children,
  'aria-label': ariaLabel = 'Меню',
  zIndexBase = 300,
}: HeroContextMenuProps) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.backdrop} style={{ zIndex: zIndexBase }} onClick={onClose} aria-hidden />
      <div
        className={styles.menu}
        style={{ ...menuStyle, zIndex: zIndexBase + 1 }}
        role="menu"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function HeroContextMenuItem({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.item} ${danger ? styles.itemDanger : ''}`}
      role="menuitem"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
