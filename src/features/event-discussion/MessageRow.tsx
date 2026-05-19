import { useState, useEffect } from 'react';
import type { IMessage } from '@/entities/conversation';
import { updateMessage } from '@/entities/conversation';
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.messageText);
  const [displayText, setDisplayText] = useState(message.messageText);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isMine = !!currentAccountId && message.accountId === currentAccountId;
  const canExpand = message.replied;

  useEffect(() => {
    setDisplayText(message.messageText);
    setEditText(message.messageText);
  }, [message.messageText]);

  const startEdit = () => {
    setEditText(displayText);
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditText(displayText);
    setEditError(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || !currentAccountId || savingEdit) return;
    if (trimmed === displayText) {
      setEditing(false);
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateMessage({
        id: message.id,
        conversationId,
        messageText: trimmed,
        accountId: currentAccountId,
        replyTo: message.replyTo ?? null,
      });
      setDisplayText(trimmed);
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <article className={styles.row} style={{ marginLeft: depth * 16 }}>
      <header className={styles.head}>
        <span className={styles.author}>{messageAuthorName(message)}</span>
        {isMine && <span className={styles.you}>вы</span>}
        <time className={styles.time}>{formatMessageDate(message.createDate)}</time>
      </header>

      {editing ? (
        <div className={styles.editBlock}>
          <textarea
            className={styles.editInput}
            rows={3}
            value={editText}
            disabled={savingEdit}
            onChange={(e) => setEditText(e.target.value)}
          />
          {editError && <p className={styles.editError}>{editError}</p>}
          <div className={styles.editActions}>
            <button type="button" className={styles.linkBtn} disabled={savingEdit} onClick={cancelEdit}>
              Отмена
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              disabled={savingEdit || !editText.trim()}
              onClick={() => void saveEdit()}
            >
              {savingEdit ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.text}>{displayText}</p>
      )}

      {!editing && (
        <footer className={styles.foot}>
          {currentAccountId && (
            <button type="button" className={styles.linkBtn} onClick={() => onReply(message)}>
              Ответить
            </button>
          )}
          {isMine && (
            <button type="button" className={styles.linkBtn} onClick={startEdit}>
              Редактировать
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
      )}

      {canExpand && expanded && (
        <MessageReplies
          parent={message}
          depth={depth}
          conversationId={conversationId}
          currentAccountId={currentAccountId}
          onReply={onReply}
        />
      )}
    </article>
  );
}
