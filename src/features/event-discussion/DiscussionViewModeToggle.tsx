import type { DiscussionViewMode } from './discussionViewMode';
import styles from './DiscussionViewModeToggle.module.css';

interface DiscussionViewModeToggleProps {
  value: DiscussionViewMode;
  onChange: (mode: DiscussionViewMode) => void;
  className?: string;
}

function TreeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 4v7a3 3 0 0 0 3 3h3" />
      <path d="M6 11a3 3 0 0 0 3 3h3" />
      <circle cx="6" cy="4" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function DiscussionViewModeToggle({
  value,
  onChange,
  className,
}: DiscussionViewModeToggleProps) {
  return (
    <div
      className={`${styles.toggle}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Вид комментариев"
    >
      <button
        type="button"
        className={`${styles.btn} ${value === 'tree' ? styles.btnActive : ''}`}
        aria-pressed={value === 'tree'}
        aria-label="Дерево"
        title="Дерево"
        onClick={() => onChange('tree')}
      >
        <TreeIcon />
      </button>
      <button
        type="button"
        className={`${styles.btn} ${value === 'flat' ? styles.btnActive : ''}`}
        aria-pressed={value === 'flat'}
        aria-label="Лента"
        title="Лента"
        onClick={() => onChange('flat')}
      >
        <ListIcon />
      </button>
    </div>
  );
}
