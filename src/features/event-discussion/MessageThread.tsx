import { useState } from 'react';
import type { IMessage } from '@/entities/conversation';
import { createMessage } from '@/entities/conversation';
import { useRootMessages } from './useRootMessages';
import { MessageRow } from './MessageRow';
import { MessageComposer } from './MessageComposer';
import { messageAuthorName } from './messageUtils';
import { DiscussionRefreshProvider, useDiscussionRefreshActions } from './discussionRefreshContext';
import styles from './MessageThread.module.css';

interface MessageThreadProps {
  conversationId: string;
  currentAccountId: string | null;
}

function MessageThreadInner({ conversationId, currentAccountId }: MessageThreadProps) {
  const { messages, loading, loadingMore, hasMore, remainingMore, error, loadMore, refresh } =
    useRootMessages(conversationId);
  const { bump } = useDiscussionRefreshActions();
  const [replyTarget, setReplyTarget] = useState<IMessage | null>(null);

  const handleSubmit = async (text: string) => {
    if (!currentAccountId) return;
    const replyToId = replyTarget?.id ?? null;
    await createMessage({
      conversationId,
      messageText: text,
      accountId: currentAccountId,
      replyTo: replyToId,
    });
    if (replyToId) {
      bump(replyToId);
    } else {
      refresh();
    }
    setReplyTarget(null);
  };

  return (
    <div className={styles.thread}>
      {loading && <p className={styles.muted}>Загрузка…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className={styles.muted}>Пока нет комментариев. Будьте первым!</p>
      )}
      <div className={styles.list}>
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            depth={0}
            conversationId={conversationId}
            currentAccountId={currentAccountId}
            onReply={setReplyTarget}
          />
        ))}
      </div>
      {hasMore && (
        <button type="button" className={styles.moreBtn} disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Загрузка…' : `Загрузить ещё (${remainingMore})`}
        </button>
      )}
      {currentAccountId ? (
        <MessageComposer
          replyingTo={replyTarget ? messageAuthorName(replyTarget) : null}
          onCancelReply={() => setReplyTarget(null)}
          onSubmit={handleSubmit}
        />
      ) : (
        <p className={styles.muted}>Войдите, чтобы оставить комментарий</p>
      )}
    </div>
  );
}

export function MessageThread(props: MessageThreadProps) {
  return (
    <DiscussionRefreshProvider>
      <MessageThreadInner {...props} />
    </DiscussionRefreshProvider>
  );
}
