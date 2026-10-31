import styles from './DiscussionLoadMore.module.css';

interface DiscussionLoadMoreProps {
  remaining: number;
  loading?: boolean;
  disabled?: boolean;
  /** Например: «Ещё комментарии» / «Ещё ответы» */
  label: string;
  onLoadMore: () => void;
}

/** Кнопка последовательной подгрузки следующей порции из page API */
export function DiscussionLoadMore({
  remaining,
  loading = false,
  disabled = false,
  label,
  onLoadMore,
}: DiscussionLoadMoreProps) {
  if (remaining <= 0) return null;

  return (
    <button
      type="button"
      className={styles.moreBtn}
      disabled={disabled || loading}
      onClick={onLoadMore}
    >
      {loading ? 'Загрузка…' : `${label} (${remaining})`}
    </button>
  );
}
