// features/agreements/AgreementDocumentHtml.tsx — HTML-текст документа соглашения

import styles from './AgreementDocumentHtml.module.css';

interface AgreementDocumentHtmlProps {
  html: string;
  className?: string;
}

/**
 * Контент документа с бэка: HTML или обычный текст.
 * Без тегов текст рендерится как есть; переносы строк сохраняются (pre-wrap).
 */
export function AgreementDocumentHtml({ html, className }: AgreementDocumentHtmlProps) {
  if (!html) return null;

  return (
    <div
      className={`${styles.root} ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
