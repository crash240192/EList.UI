import { useState, useEffect, useRef } from 'react';
import type { IMessage } from '@/entities/conversation';
import { updateMessage, fetchMessageReplies } from '@/entities/conversation';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import {
  messageAuthorName,
  messageInitials,
  formatMessageDate,
  formatReplyCount,
  discussionMessageDomId,
  isLongMessageText,
} from './messageUtils';
import { DISCUSSION_MESSAGE_MAX_LENGTH } from './discussionUiConstants';
import { MessageReplies } from './MessageReplies';
import { useDiscussionRefresh } from './discussionRefreshContext';
import styles from './MessageRow.module.css';

interface MessageRowProps {
  message: IMessage;
  depth: number;
  highlighted?: boolean;
  activeReplyId?: string | null;
  conversationId: string;
  currentAccountId: string | null;
  onReply: (message: IMessage) => void;
}

function ReplyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function MessageRow({
  message,
  depth,
  highlighted = false,
  activeReplyId = null,
  conversationId,
  currentAccountId,
  onReply,
}: MessageRowProps) {
  const [expanded, setExpanded] = useState(message.replied);
  const [textExpanded, setTextExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.messageText);
  const [displayText, setDisplayText] = useState(message.messageText);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [replyTotal, setReplyTotal] = useState<number | null>(null);

  const replyBump = useDiscussionRefresh(message.id);
  const prevReplyBump = useRef(replyBump);
  const isMine = !!currentAccountId && message.accountId === currentAccountId;
  const hasReplies = message.replied || replyBump > 0;
  const accountId = message.accountId ?? message.account?.id ?? '';
  const initials = messageInitials(message);

  useEffect(() => {
    setDisplayText(message.messageText);
    setEditText(message.messageText);
    setTextExpanded(false);
  }, [message.id, message.messageText]);

  useEffect(() => {
    if (replyBump > prevReplyBump.current) setExpanded(true);
    prevReplyBump.current = replyBump;
  }, [replyBump]);

  useEffect(() => {
    if (!hasReplies || expanded) return;

    let cancelled = false;
    void fetchMessageReplies(message.id, 0, 1)
      .then(paged => {
        if (!cancelled) setReplyTotal(paged.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setReplyTotal(null);
      });

    return () => { cancelled = true; };
  }, [message.id, hasReplies, expanded, replyBump]);

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
    if (!trimmed || !currentAccountId || savingEdit || trimmed.length > DISCUSSION_MESSAGE_MAX_LENGTH) return;
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

  const collapsedRepliesLabel = replyTotal != null && replyTotal > 0
    ? formatReplyCount(replyTotal)
    : 'Есть ответы';
  const isLongText = isLongMessageText(displayText);

  return (
    <div className={styles.wrap}>
      <article
        id={discussionMessageDomId(message.id)}
        className={`${styles.card} ${isMine ? styles.cardMine : ''} ${highlighted ? styles.cardHighlight : ''} ${highlighted ? styles.cardReplyTarget : ''}`}
      >
        <div className={styles.cardInner}>
          {accountId ? (
            <UserAvatar
              accountId={accountId}
              avatarId={message.account?.avatarId ?? null}
              initials={initials}
              size={36}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarFallback} aria-hidden>
              {initials}
            </div>
          )}
          <div className={styles.content}>
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
                  maxLength={DISCUSSION_MESSAGE_MAX_LENGTH}
                  onChange={(e) => setEditText(e.target.value)}
                />
                {editError && <p className={styles.editError}>{editError}</p>}
                <div className={styles.editActions}>
                  <button type="button" className={styles.actionBtn} disabled={savingEdit} onClick={cancelEdit}>
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
              <>
                <p className={`${styles.text} ${isLongText && !textExpanded ? styles.textClamped : ''}`}>
                  {displayText}
                </p>
                {isLongText && (
                  <button
                    type="button"
                    className={styles.textToggle}
                    onClick={() => setTextExpanded(v => !v)}
                    aria-expanded={textExpanded}
                  >
                    <span className={styles.textToggleLine} aria-hidden />
                    <span className={styles.textToggleBody}>
                      <span className={styles.textToggleTitle}>
                        {textExpanded ? 'Свернуть' : 'Показать полностью'}
                      </span>
                      <span className={styles.textToggleHint}>
                        {textExpanded ? 'Скрыть комментарий' : 'Развернуть комментарий'}
                      </span>
                    </span>
                    {textExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                )}
              </>
            )}

            {!editing && (
              <footer className={styles.foot}>
                {currentAccountId && (
                  <button type="button" className={styles.actionBtn} onClick={() => onReply(message)}>
                    <ReplyIcon />
                    Ответить
                  </button>
                )}
                {isMine && (
                  <button type="button" className={styles.actionBtn} onClick={startEdit}>
                    <EditIcon />
                    Редактировать
                  </button>
                )}
                {hasReplies && expanded && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnMuted}`}
                    onClick={() => setExpanded(false)}
                  >
                    <ChevronUpIcon />
                    Скрыть ответы
                  </button>
                )}
              </footer>
            )}
          </div>
        </div>
      </article>

      {hasReplies && !expanded && (
        <button
          type="button"
          className={styles.collapsedReplies}
          onClick={() => setExpanded(true)}
          aria-expanded={false}
        >
          <span className={styles.collapsedRepliesLine} aria-hidden />
          <span className={styles.collapsedRepliesBody}>
            <span className={styles.collapsedRepliesCount}>{collapsedRepliesLabel}</span>
            <span className={styles.collapsedRepliesHint}>Показать цепочку</span>
          </span>
          <ChevronDownIcon />
        </button>
      )}

      {hasReplies && expanded && (
        <MessageReplies
          parent={message}
          depth={depth}
          refreshKey={replyBump}
          activeReplyId={activeReplyId}
          conversationId={conversationId}
          currentAccountId={currentAccountId}
          onReply={onReply}
          onTotalLoaded={setReplyTotal}
        />
      )}
    </div>
  );
}
