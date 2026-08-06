import { useState, useEffect, useRef, useCallback } from 'react';
import type { IConversation } from '@/entities/conversation';
import { fetchEventConversations } from '@/entities/conversation';
import { MessageThread } from './MessageThread';
import { DiscussionFormModal } from './DiscussionFormModal';
import { DiscussionsManageModal } from './DiscussionsManageModal';
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
  const [manageOpen, setManageOpen] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
  const layoutBoundsRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const showPanelSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);

  const updateTabFades = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) {
      setFadeLeft(false);
      setFadeRight(false);
      return;
    }
    setFadeLeft(el.scrollLeft > 2);
    setFadeRight(el.scrollLeft < maxScroll - 2);
  }, []);

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
      return list;
    } catch (e: unknown) {
      if (isAccessDeniedError(e)) {
        setAccessDenied(true);
        setConversations([]);
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить обсуждения');
      }
      return [];
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

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    updateTabFades();
    el.addEventListener('scroll', updateTabFades, { passive: true });
    const observer = new ResizeObserver(updateTabFades);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateTabFades);
      observer.disconnect();
    };
  }, [updateTabFades, conversations.length, canManage, loading]);

  const handleCreated = async (conversationId: string) => {
    await loadConversations();
    setActiveId(conversationId);
  };

  const handleDiscussionsChanged = async () => {
    const list = await loadConversations();
    if (list.length === 0) setManageOpen(false);
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
      <div className={styles.tabsRow}>
        <div className={styles.tabsWrap}>
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
          {fadeLeft && <div className={`${styles.tabsFade} ${styles.tabsFadeLeft}`} aria-hidden />}
          {fadeRight && <div className={`${styles.tabsFade} ${styles.tabsFadeRight}`} aria-hidden />}
        </div>
        {canManage && conversations.length > 0 && (
          <button
            type="button"
            className={styles.editTabsBtn}
            onClick={() => setManageOpen(true)}
            aria-label="Редактировать обсуждения"
            title="Редактировать обсуждения"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
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
            canComment={!active.participantsReadonly || canManage}
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

      {manageOpen && (
        <DiscussionsManageModal
          eventId={eventId}
          conversations={conversations}
          onClose={() => setManageOpen(false)}
          onChanged={() => void handleDiscussionsChanged()}
        />
      )}
    </div>
  );
}
