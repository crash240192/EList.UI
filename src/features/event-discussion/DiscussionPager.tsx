import styles from './DiscussionPager.module.css';

interface DiscussionPagerProps {
  pageIndex: number;
  totalPages: number;
  totalItems: number;
  disabled?: boolean;
  label?: string;
  onPageChange: (pageIndex: number) => void;
}

export function DiscussionPager({
  pageIndex,
  totalPages,
  totalItems,
  disabled = false,
  label,
  onPageChange,
}: DiscussionPagerProps) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(0, pageIndex), totalPages - 1);
  const canPrev = safePage > 0 && !disabled;
  const canNext = safePage < totalPages - 1 && !disabled;

  return (
    <nav className={styles.pager} aria-label={label ?? 'Страницы'}>
      {label && <span className={styles.caption}>{label}</span>}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.btn}
          disabled={!canPrev}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Предыдущая страница"
        >
          Назад
        </button>
        <span className={styles.status} aria-live="polite">
          {safePage + 1} / {totalPages}
          <span className={styles.total}> · {totalItems}</span>
        </span>
        <button
          type="button"
          className={styles.btn}
          disabled={!canNext}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Следующая страница"
        >
          Вперёд
        </button>
      </div>
    </nav>
  );
}
