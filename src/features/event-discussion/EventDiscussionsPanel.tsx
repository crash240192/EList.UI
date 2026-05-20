import { useState, useEffect, useRef } from 'react';
import type { IConversation } from '@/entities/conversation';
import { fetchEventConversations } from '@/entities/conversation';
import { MessageThread } from './MessageThread';
import styles from './EventDiscussionsPanel.module.css';

interface EventDiscussionsPanelProps {
  eventId: string;
  currentAccountId: string | null;
}

export function EventDiscussionsPanel({ eventId, currentAccountId }: EventDiscussionsPanelProps) {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const layoutBoundsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchEventConversations(eventId)
      .then((list) => {
        setConversations(list);
        setActiveId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить обсуждения'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return <p className={styles.loading}>Загрузка обсуждений…</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (conversations.length === 0) {
    return <p className={styles.empty}>Пока нет обсуждений</p>;
  }

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="tablist">
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === active.id}
            className={`${styles.tab} ${c.id === active.id ? styles.tabActive : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div ref={layoutBoundsRef} className={styles.body} role="tabpanel">
        <MessageThread
          key={active.id}
          conversationId={active.id}
          currentAccountId={currentAccountId}
          layoutBoundsRef={layoutBoundsRef}
        />
      </div>
    </div>
  );
}
