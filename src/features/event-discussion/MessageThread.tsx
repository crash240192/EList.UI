import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { IMessage } from '@/entities/conversation';
import { createMessage } from '@/entities/conversation';
import { useRootMessages } from './useRootMessages';
import { MessageRow } from './MessageRow';
import { MessageComposer } from './MessageComposer';
import { DiscussionComposerSheet } from './DiscussionComposerSheet';
import { messageAuthorName, needsReplyScrollTailSpacer, scrollMessageIntoViewForReply, discussionMessageDomId, findScrollParent } from './messageUtils';
import type { HoleRect } from './discussionDimClipPath';
import { DiscussionRefreshProvider, useDiscussionRefreshActions } from './discussionRefreshContext';
import { useDiscussionSlotRect } from './useDiscussionSlotRect';
import styles from './MessageThread.module.css';

interface MessageThreadProps {
  conversationId: string;
  currentAccountId: string | null;
  /** Границы колонки обсуждения (для fixed-формы по ширине экрана) */
  layoutBoundsRef?: RefObject<HTMLElement | null>;
}

function MessageThreadInner({
  conversationId,
  currentAccountId,
  layoutBoundsRef,
}: MessageThreadProps) {
  const { messages, loading, loadingMore, hasMore, remainingMore, error, loadMore, refresh } =
    useRootMessages(conversationId);
  const { bump } = useDiscussionRefreshActions();
  const [replyTarget, setReplyTarget] = useState<IMessage | null>(null);
  const [replyScrollTailPx, setReplyScrollTailPx] = useState(0);
  const [replyHighlightHole, setReplyHighlightHole] = useState<HoleRect | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const anchorRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const boundsRef = layoutBoundsRef ?? threadRef;

  useEffect(() => {
    const node = anchorRef.current;
    if (!node || !currentAccountId) return;

    const observer = new IntersectionObserver(
      ([entry]) => setDockVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px 24px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentAccountId, messages.length, loading]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setReplyTarget(null);
    setReplyScrollTailPx(0);
    setReplyHighlightHole(null);
  }, []);

  const handleReply = useCallback((message: IMessage) => {
    const reserve = 320;
    setReplyScrollTailPx(needsReplyScrollTailSpacer(message.id, reserve) ? 340 : 0);
    setReplyTarget(message);
    setSheetOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!sheetOpen) {
      setReplyHighlightHole(null);
      return;
    }

    if (!replyTarget) {
      setReplyHighlightHole(null);
      return;
    }

    const mid = replyTarget.id;

    const updateHole = () => {
      const el = document.getElementById(discussionMessageDomId(mid));
      if (!el) {
        setReplyHighlightHole(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setReplyHighlightHole({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const scrollToReply = () => {
      const composerHeight = sheetRef.current?.offsetHeight ?? 220;
      scrollMessageIntoViewForReply(mid, composerHeight);
      updateHole();
    };

    updateHole();
    const anchorEl = document.getElementById(discussionMessageDomId(mid));
    const scrollRoot = anchorEl ? findScrollParent(anchorEl) : null;

    window.addEventListener('resize', updateHole);
    window.addEventListener('scroll', updateHole, true);
    scrollRoot?.addEventListener('scroll', updateHole, { passive: true });

    scrollToReply();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      scrollToReply();
      raf2 = requestAnimationFrame(scrollToReply);
    });
    const delayed = window.setTimeout(scrollToReply, 340);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(delayed);
      window.removeEventListener('resize', updateHole);
      window.removeEventListener('scroll', updateHole, true);
      scrollRoot?.removeEventListener('scroll', updateHole);
    };
  }, [sheetOpen, replyTarget, replyScrollTailPx]);

  const openSheetForNewComment = useCallback(() => {
    setReplyTarget(null);
    setReplyScrollTailPx(0);
    setSheetOpen(true);
  }, []);

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
    closeSheet();
  };

  const activeReplyId = sheetOpen ? replyTarget?.id ?? null : null;
  const showDock = !!currentAccountId && dockVisible && !sheetOpen;
  const showFab = !!currentAccountId && !dockVisible && !sheetOpen;

  const trackSlot = sheetOpen || showFab;
  const slot = useDiscussionSlotRect(boundsRef, trackSlot);

  const fabStyle: CSSProperties | undefined = showFab
    ? {
        position: 'fixed',
        left:
          slot.width > 0
            ? Math.min(slot.left + slot.width - 52 - 8, window.innerWidth - 60)
            : window.innerWidth - 60,
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        zIndex: 499,
      }
    : undefined;

  return (
    <div ref={threadRef} className={styles.thread}>
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
            highlighted={activeReplyId === msg.id}
            activeReplyId={activeReplyId}
            conversationId={conversationId}
            currentAccountId={currentAccountId}
            onReply={handleReply}
          />
        ))}
      </div>
      {hasMore && (
        <button type="button" className={styles.moreBtn} disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Загрузка…' : `Загрузить ещё (${remainingMore})`}
        </button>
      )}

      {sheetOpen && replyTarget && replyScrollTailPx > 0 && (
        <div className={styles.replyScrollTail} style={{ height: replyScrollTailPx }} aria-hidden />
      )}

      <div ref={anchorRef} className={styles.composerAnchor}>
        {showDock && (
          <div className={styles.composerDock}>
            <MessageComposer
              replyingTo={replyTarget ? messageAuthorName(replyTarget) : null}
              onCancelReply={() => setReplyTarget(null)}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>

      {!currentAccountId && (
        <p className={styles.muted}>Войдите, чтобы оставить комментарий</p>
      )}

      {showFab && (
        <button
          type="button"
          className={styles.fab}
          style={fabStyle}
          aria-label="Написать комментарий"
          onClick={openSheetForNewComment}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      <DiscussionComposerSheet
        open={sheetOpen}
        sheetRef={sheetRef}
        slot={slot}
        highlightHole={replyTarget ? replyHighlightHole : null}
        onClose={closeSheet}
        replyingTo={replyTarget ? messageAuthorName(replyTarget) : null}
        onCancelReply={() => setReplyTarget(null)}
        onSubmit={handleSubmit}
      />
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
