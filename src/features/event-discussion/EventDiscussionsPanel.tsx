import { useState, useEffect, useRef, useCallback } from 'react';
import type { IConversation } from '@/entities/conversation';
import { fetchEventConversations } from '@/entities/conversation';
import { MessageThread } from './MessageThread';
import { DiscussionFormModal } from './DiscussionFormModal';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { EventDiscussionsPanelSkeleton } from './EventDiscussionsPanelSkeleton';
import { AccessDeniedGate } from '@/shared/ui/AccessDenied/AccessDeniedGate';
import { isAccessDeniedError } from '@/shared/api/apiErrorUtils';
import styles from './EventDiscussionsPanel.module.css';

interface EventDiscussionsPanelProps {
  eventId: string;
  currentAccountId: string | null;
  canManage?: boolean;
}

export function EventDiscussionsPanel({
  eventId,
  currentAccountId,
  canManage = false,
}: EventDiscussionsPanelProps) {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const layoutBoundsRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const showPanelSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const list = await fetchEventConversations(eventId);
      setConversations(list);
      setActiveId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: unknown) {
      if (isAccessDeniedError(e)) {
        setAccessDenied(true);
        setConversations([]);
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить обсуждения');
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [conversations.length, canManage]);

  const handleCreated = async (conversationId: string) => {
    await loadConversations();
    setActiveId(conversationId);
  };

  if (accessDenied) {
    return (
      <AccessDeniedGate denied variant="section" className={styles.panel}>
        <EventDiscussionsPanelSkeleton showSpinner={false} />
      </AccessDeniedGate>
    );
  }

  if (loading) {
    return (
      <div className={styles.panel} role="status" aria-label="Загрузка обсуждений">
        <EventDiscussionsPanelSkeleton showSpinner={showPanelSpinner} />
      </div>
    );
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (conversations.length === 0 && !canManage) {
    return <p className={styles.empty}>Пока нет обсуждений</p>;
  }

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;

  return (
    <div className={styles.panel}>
      <div ref={tabsRef} className={styles.tabs} role="tablist">
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active ? c.id === active.id : false}
            className={`${styles.tab} ${active && c.id === active.id ? styles.tabActive : ''}`}
            onClick={() => setActiveId(c.id)}
          >
            {c.name}
          </button>
        ))}
        {canManage && (
          <button
            type="button"
            className={styles.addTabBtn}
            onClick={() => setFormOpen(true)}
            aria-label="Добавить обсуждение"
          >
            <span className={styles.addTabIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </span>
            Добавить
          </button>
        )}
      </div>

      {active ? (
        <div ref={layoutBoundsRef} className={styles.body} role="tabpanel">
          <MessageThread
            key={active.id}
            conversationId={active.id}
            currentAccountId={currentAccountId}
            layoutBoundsRef={layoutBoundsRef}
          />
        </div>
      ) : (
        <p className={styles.empty}>Добавьте первое обсуждение</p>
      )}

      {formOpen && (
        <DiscussionFormModal
          eventId={eventId}
          onClose={() => setFormOpen(false)}
          onCreated={conversationId => void handleCreated(conversationId)}
        />
      )}
    </div>
  );
}
