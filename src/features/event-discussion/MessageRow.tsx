import { useState } from 'react';
import type { IMessage } from '@/entities/conversation';
import { messageAuthorName, formatMessageDate } from './messageUtils';
import { MessageReplies } from './MessageReplies';
import styles from './MessageRow.module.css';

interface MessageRowProps {
  message: IMessage;
  depth: number;
  conversationId: string;
  currentAccountId: string | null;
  onReply: (message: IMessage) => void;
}

export function MessageRow({
  message,
  depth,
  conversationId,
  currentAccountId,
  onReply,
}: MessageRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isMine = !!currentAccountId && message.accountId === currentAccountId;
  const canExpand = depth === 0 && message.replied;

  return (
    <article className={styles.row} style={{ marginLeft: depth * 16 }}>
      <header className={styles.head}>
        <span className={styles.author}>{messageAuthorName(message)}</span>
        {isMine && <span className={styles.you}>вы</span>}
        <time className={styles.time}>{formatMessageDate(message.createDate)}</time>
      </header>
      <p className={styles.text}>{message.messageText}</p>
      <footer className={styles.foot}>
        {currentAccountId && (
          <button type="button" className={styles.linkBtn} onClick={() => onReply(message)}>
            Ответить
          </button>
        )}
        {canExpand && (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Скрыть ответы' : 'Показать ответы'}
          </button>
        )}
      </footer>
      {canExpand && expanded && (
        <MessageReplies
          parent={message}
          conversationId={conversationId}
          currentAccountId={currentAccountId}
          onReply={onReply}
        />
      )}
    </article>
  );
}
