import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { IMessage } from '@/entities/conversation';
import { createMessage } from '@/entities/conversation';
import { useRootMessages } from './useRootMessages';
import { MessageRow } from './MessageRow';
import { MessageComposer } from './MessageComposer';
import { DiscussionComposerSheet } from './DiscussionComposerSheet';
import {
  messageAuthorName,
  computeReplyScrollTailPx,
  scrollMessageIntoViewForReply,
  discussionMessageDomId,
  findScrollParent,
  getReplyComposerReservePx,
  getDefaultComposerHeightEstimate,
  isNarrowReplyViewport,
} from './messageUtils';
import type { HoleRect } from './discussionDimClipPath';
import { DiscussionRefreshProvider, useDiscussionRefreshActions } from './discussionRefreshContext';
import { useDiscussionSlotRect } from './useDiscussionSlotRect';
import { AppPreloader } from '@/shared/ui/AppPreloader/AppPreloader';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
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
  const { messages, loading, loadingMore, hasMore, remainingMore, error, loadMore, refresh, removeMessage } =
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
    const reserve = getReplyComposerReservePx(getDefaultComposerHeightEstimate());
    setReplyScrollTailPx(computeReplyScrollTailPx(message.id, reserve));
    setReplyTarget(message);
    setSheetOpen(true);
  }, []);

  const handleDeleted = useCallback((messageId: string) => {
    removeMessage(messageId);
    if (replyTarget?.id === messageId) {
      closeSheet();
    }
  }, [removeMessage, replyTarget, closeSheet]);

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
    const narrow = isNarrowReplyViewport();
    const followUpBehavior: ScrollBehavior = narrow ? 'auto' : 'smooth';

    const updateHole = () => {
      const el = document.getElementById(discussionMessageDomId(mid));
      if (!el) {
        setReplyHighlightHole(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setReplyHighlightHole({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const scrollToReply = (behavior: ScrollBehavior = followUpBehavior) => {
      const sheetHeight = sheetRef.current?.offsetHeight ?? getDefaultComposerHeightEstimate();
      const reserve = getReplyComposerReservePx(sheetHeight);
      const ok = scrollMessageIntoViewForReply(mid, reserve, { behavior });
      if (!ok) {
        setReplyScrollTailPx(prev => {
          const max = Math.ceil(window.innerHeight * (narrow ? 0.65 : 0.75));
          if (prev >= max) return prev;
          const step = narrow ? 96 : 140;
          return Math.min(prev + step, max);
        });
      }
      updateHole();
    };

    updateHole();
    const anchorEl = document.getElementById(discussionMessageDomId(mid));
    const scrollRoot = anchorEl ? findScrollParent(anchorEl) : null;
    const visualViewport = window.visualViewport;

    let viewportTimer = 0;
    const onViewportChange = () => {
      window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => scrollToReply(followUpBehavior), narrow ? 48 : 16);
    };

    window.addEventListener('resize', updateHole);
    window.addEventListener('scroll', updateHole, true);
    scrollRoot?.addEventListener('scroll', updateHole, { passive: true });
    visualViewport?.addEventListener('resize', onViewportChange);
    visualViewport?.addEventListener('scroll', onViewportChange);

    let resizeObserver: ResizeObserver | null = null;
    const attachSheetObserver = () => {
      const el = sheetRef.current;
      if (!el || resizeObserver) return;
      resizeObserver = new ResizeObserver(() => scrollToReply(followUpBehavior));
      resizeObserver.observe(el);
    };
    attachSheetObserver();

    scrollToReply('auto');
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      attachSheetObserver();
      scrollToReply('auto');
      raf2 = requestAnimationFrame(() => scrollToReply(followUpBehavior));
    });
    const delays = (narrow ? [80, 200, 420] : [50, 120, 340, 520]).map(ms => window.setTimeout(() => {
      attachSheetObserver();
      scrollToReply(followUpBehavior);
    }, ms));

    return () => {
      window.clearTimeout(viewportTimer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      delays.forEach(window.clearTimeout);
      window.removeEventListener('resize', updateHole);
      window.removeEventListener('scroll', updateHole, true);
      scrollRoot?.removeEventListener('scroll', updateHole);
      visualViewport?.removeEventListener('resize', onViewportChange);
      visualViewport?.removeEventListener('scroll', onViewportChange);
      resizeObserver?.disconnect();
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

  const showThreadSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);
  const showMoreSpinner = useDelayedBusy(loadingMore, DISCUSSION_PRELOADER_DELAY_MS);

  const fabStyle: CSSProperties | undefined = showFab
    ? {
        position: 'fixed',
        left:
          slot.width > 0
            ? Math.max(12, slot.left + 8)
            : 16,
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        zIndex: 499,
      }
    : undefined;

  return (
    <div ref={threadRef} className={styles.thread}>
      {loading && (
        <div className={styles.skeletonStatus} role="status" aria-label="Загрузка комментариев">
          <DiscussionMessageSkeleton variant="thread" showSpinner={showThreadSpinner} />
        </div>
      )}
      {!loading && error && <p className={styles.error}>{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className={styles.muted}>Пока нет комментариев. Будьте первым!</p>
      )}
      {!loading && (
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
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
      {hasMore && !loading && !error && (
        <button
          type="button"
          className={`${styles.moreBtn} ${loadingMore && showMoreSpinner ? styles.moreBtnLoading : ''}`}
          disabled={loadingMore}
          onClick={loadMore}
          aria-busy={loadingMore}
          aria-label={loadingMore ? 'Загрузка' : undefined}
        >
          {loadingMore && showMoreSpinner ? (
            <AppPreloader size="sm" layout="inline" role="none" />
          ) : (
            `Загрузить ещё (${remainingMore})`
          )}
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
