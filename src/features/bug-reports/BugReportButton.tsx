// features/bug-reports/BugReportButton.tsx
// Кнопка в хедере: сообщить об ошибке (только для авторизованных)

import { useState } from 'react';
import { BugReportModal } from './BugReportModal';
import styles from './BugReportButton.module.css';

export function BugReportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen(true)}
        aria-label="Сообщить об ошибке"
        title="Сообщить об ошибке"
      >
        <BugIcon />
      </button>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function BugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 9V8a4 4 0 0 1 8 0v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="7"
        y="9"
        width="10"
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 13v3M4 12h3M17 12h3M5 7l2 2M19 7l-2 2M5 19l2-2M19 19l-2-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
