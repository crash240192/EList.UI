// features/agreements/AgreementDocumentHtml.tsx — HTML-текст документа соглашения

import styles from './AgreementDocumentHtml.module.css';

interface AgreementDocumentHtmlProps {
  html: string;
  className?: string;
}

const HAS_HTML_TAG = /<[a-z][\s\S]*>/i;

/** Убирает ведущие пустые блоки/переносы, которые дают «пустые строки» сверху */
function normalizeDocumentHtml(raw: string): string {
  let s = raw.trim();
  // Пустые абзацы / br в начале (часто из редакторов)
  s = s.replace(/^(?:\s|<(?:p|div)\b[^>]*>\s*(?:<br\s*\/?>)?\s*<\/(?:p|div)>|<br\s*\/?>)+/i, '');
  return s.trim();
}

/**
 * Контент документа с бэка: HTML или обычный текст.
 * HTML — обычный flow (без pre-wrap); plain text — с сохранением переносов.
 */
export function AgreementDocumentHtml({ html, className }: AgreementDocumentHtmlProps) {
  if (!html?.trim()) return null;

  const isHtml = HAS_HTML_TAG.test(html);
  const content = isHtml ? normalizeDocumentHtml(html) : html.trim();

  return (
    <div
      className={`${styles.root} ${isHtml ? styles.html : styles.plain} ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
