import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { IMessage, IMessageLocation, IMessagePathNode } from '@/entities/conversation';
import { createMessage, fetchMessageLocation } from '@/entities/conversation';
import { useRootMessages } from './useRootMessages';
import { MessageRow } from './MessageRow';
import { MessageComposer } from './MessageComposer';
import { DiscussionComposerSheet } from './DiscussionComposerSheet';
import {
  messageAuthorName,
  computeReplyScrollTailPx,
  scrollMessageIntoViewForReply,
  scrollDiscussionMessageIntoView,
  discussionMessageDomId,
  findScrollParent,
  getReplyComposerReservePx,
  getDefaultComposerHeightEstimate,
  isNarrowReplyViewport,
} from './messageUtils';
import type { HoleRect } from './discussionDimClipPath';
import { DiscussionRefreshProvider, useDiscussionRefreshActions } from './discussionRefreshContext';
import { useDiscussionSlotRect } from './useDiscussionSlotRect';
import { useDelayedBusy } from '@/shared/lib/useDelayedBusy';
import { DISCUSSION_PRELOADER_DELAY_MS } from './discussionUiConstants';
import {
  DISCUSSION_ROOT_PAGE_SIZE,
  DISCUSSION_TREE_SIBLING_PAGE_SIZE,
  type DiscussionViewMode,
} from './discussionViewMode';
import { DiscussionMessageSkeleton } from './DiscussionMessageSkeleton';
import { DiscussionLoadMore } from './DiscussionLoadMore';
import {
  clearDiscussionChromeClearance,
  setDiscussionChromeClearance,
} from './discussionChromeClearance';
import styles from './MessageThread.module.css';

interface MessageThreadProps {
  conversationId: string;
  currentAccountId: string | null;
  /** Границы колонки обсуждения (для fixed-формы по ширине экрана) */
  layoutBoundsRef?: RefObject<HTMLElement | null>;
  /** Можно ли писать комментарии (false — только чтение) */
  canComment?: boolean;
  /** Дерево или лента — управляется панелью обсуждений */
  viewMode?: DiscussionViewMode;
  /** Deep-link: прокрутить к сообщению после загрузки нужных страниц */
  focusMessageId?: string | null;
  /** После успешной прокрутки к комментарию */
  onFocusHandled?: () => void;
}

function MessageThreadInner({
  conversationId,
  currentAccountId,
  layoutBoundsRef,
  canComment = true,
  viewMode = 'tree',
  focusMessageId = null,
  onFocusHandled,
}: MessageThreadProps) {
  const location = useLocation();
  const [focusLocation, setFocusLocation] = useState<IMessageLocation | null>(null);
  /** null пока ждём location; иначе стартовая страница корней */
  const [bootstrapPage, setBootstrapPage] = useState<number | null>(
    focusMessageId ? null : 0,
  );
  const focusHandledRef = useRef(false);
  /** После успешного скролла: путь оставляем (ветки раскрыты), скролл/highlight больше не гоняем */
  const [focusSettled, setFocusSettled] = useState(false);

  useEffect(() => {
    if (!focusMessageId) {
      // Query уже очищен после успешного deep-link — не сбрасываем focusLocation,
      // иначе ветки сворачиваются и MessageReplies перезагружается.
      setBootstrapPage((prev) => (prev === null ? 0 : prev));
      return;
    }

    focusHandledRef.current = false;
    setFocusSettled(false);
    let cancelled = false;
    setFocusLocation(null);
    setBootstrapPage(null);
    void (async () => {
      try {
        const loc = await fetchMessageLocation(focusMessageId, {
          rootPageSize: DISCUSSION_ROOT_PAGE_SIZE,
          siblingPageSize: DISCUSSION_TREE_SIBLING_PAGE_SIZE,
        });
        if (cancelled) return;
        if (!loc || loc.conversationId !== conversationId) {
          setBootstrapPage((prev) => (prev === null ? 0 : prev));
          return;
        }
        setFocusLocation(loc);
        setBootstrapPage(loc.rootPageIndex);
      } catch {
        if (!cancelled) setBootstrapPage((prev) => (prev === null ? 0 : prev));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [focusMessageId, conversationId]);

  const rootsConversationId = bootstrapPage !== null ? conversationId : null;
  const { messages, loading, loadingMore, remaining, error, loadMore, refresh, removeMessage } =
    useRootMessages(rootsConversationId, {
      loadThroughPage: bootstrapPage ?? 0,
    });
  const { bump } = useDiscussionRefreshActions();
  const [replyTarget, setReplyTarget] = useState<IMessage | null>(null);
  const [replyThreadRootId, setReplyThreadRootId] = useState<string | null>(null);
  const safeViewMode: DiscussionViewMode = viewMode === 'flat' ? 'flat' : 'tree';
  const [replyScrollTailPx, setReplyScrollTailPx] = useState(0);
  const [replyHighlightHole, setReplyHighlightHole] = useState<HoleRect | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const boundsRef = layoutBoundsRef ?? threadRef;
  const onFocusHandledRef = useRef(onFocusHandled);
  onFocusHandledRef.current = onFocusHandled;

  const focusTargetId = focusLocation?.messageId ?? null;
  const focusPath: IMessagePathNode[] = focusLocation?.path ?? [];
  /** Скролл и «живой» highlight — только до settle; path оставляем для раскрытия веток */
  const activeFocusTargetId = focusSettled ? null : focusTargetId;

  const markFocusHandled = useCallback(() => {
    if (focusHandledRef.current) return;
    focusHandledRef.current = true;
    setFocusSettled(true);
    // Чуть отложить очистку URL: вложенные ответы ещё дорисовываются на медленной сети
    window.setTimeout(() => {
      onFocusHandledRef.current?.();
    }, 120);
  }, []);

  /** Корень на экране — прокручиваем сразу; вложенные — после раскрытия веток */
  useEffect(() => {
    if (!activeFocusTargetId || loading || focusPath.length !== 1) return;
    if (!messages.some((m) => m.id === activeFocusTargetId)) return;

    const delays = [40, 160, 400, 800].map((ms) =>
      window.setTimeout(() => {
        if (focusHandledRef.current) return;
        if (scrollDiscussionMessageIntoView(activeFocusTargetId)) {
          markFocusHandled();
        }
      }, ms),
    );
    return () => delays.forEach((id) => window.clearTimeout(id));
  }, [activeFocusTargetId, focusPath.length, loading, messages, markFocusHandled]);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node || !currentAccountId || !canComment) return;

    const observer = new IntersectionObserver(
      ([entry]) => setDockVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px 24px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentAccountId, canComment, messages.length, loading]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setReplyTarget(null);
    setReplyThreadRootId(null);
    setReplyScrollTailPx(0);
    setReplyHighlightHole(null);
  }, []);

  const handleReply = useCallback((message: IMessage, threadRootId: string) => {
    if (!canComment) return;
    const reserve = getReplyComposerReservePx(getDefaultComposerHeightEstimate());
    setReplyScrollTailPx(computeReplyScrollTailPx(message.id, reserve));
    setReplyTarget(message);
    setReplyThreadRootId(threadRootId || message.id);
    setSheetOpen(true);
  }, [canComment]);

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
    setReplyThreadRootId(null);
    setReplyScrollTailPx(0);
    setSheetOpen(true);
  }, []);

  const handleSubmit = async ({ text, fileIds }: { text: string; fileIds: string[] }) => {
    if (!currentAccountId) return;
    const replyToId = replyTarget?.id ?? null;
    await createMessage({
      conversationId,
      messageText: text,
      accountId: currentAccountId,
      replyTo: replyToId,
      fileIds: fileIds.length ? fileIds : undefined,
    });
    if (replyToId) {
      bump(replyToId);
      if (safeViewMode === 'flat' && replyThreadRootId && replyThreadRootId !== replyToId) {
        bump(replyThreadRootId);
      }
    } else {
      refresh();
    }
    closeSheet();
  };

  const activeReplyId = sheetOpen ? replyTarget?.id ?? null : null;
  const allowCompose = !!currentAccountId && canComment;
  const showDock = allowCompose && dockVisible && !sheetOpen;
  const showFab = allowCompose && !dockVisible && !sheetOpen;

  const trackSlot = sheetOpen || showFab;
  const slot = useDiscussionSlotRect(boundsRef, trackSlot);

  /** Keep event-page scroll-top above FAB / sticky composer on mobile */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      if (sheetOpen) {
        setDiscussionChromeClearance(0);
        return;
      }
      if (showDock && dockRef.current) {
        const h = dockRef.current.getBoundingClientRect().height;
        setDiscussionChromeClearance(h + 10);
        return;
      }
      if (showFab) {
        const fabSize = window.matchMedia('(max-width: 639px)').matches ? 40 : 44;
        setDiscussionChromeClearance(fabSize + 14);
        return;
      }
      setDiscussionChromeClearance(0);
    };

    update();

    const dockEl = dockRef.current;
    if (!showDock || !dockEl || typeof ResizeObserver === 'undefined') {
      return () => clearDiscussionChromeClearance();
    }

    const ro = new ResizeObserver(() => update());
    ro.observe(dockEl);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      clearDiscussionChromeClearance();
    };
  }, [showDock, showFab, sheetOpen]);

  const showThreadSpinner = useDelayedBusy(loading, DISCUSSION_PRELOADER_DELAY_MS);

  const fabStyle: CSSProperties | undefined = showFab
    ? {
        position: 'fixed',
        left:
          slot.width > 0
            ? Math.min(slot.left + slot.width - 44 - 6, window.innerWidth - 52)
            : window.innerWidth - 52,
        bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
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
          {messages.map((msg) => {
            const onFocusPath = focusPath.length > 0 && focusPath[0]?.messageId === msg.id;
            return (
              <MessageRow
                key={msg.id}
                message={msg}
                depth={0}
                highlighted={activeReplyId === msg.id || focusTargetId === msg.id}
                focusTarget={!focusSettled && focusTargetId === msg.id}
                activeReplyId={activeReplyId}
                conversationId={conversationId}
                currentAccountId={currentAccountId}
                viewMode={safeViewMode}
                threadRootId={msg.id}
                focusPathTail={onFocusPath ? focusPath.slice(1) : undefined}
                focusTargetId={focusSettled ? null : focusTargetId}
                onFocusHandled={markFocusHandled}
                onReply={canComment ? handleReply : undefined}
                onDeleted={handleDeleted}
              />
            );
          })}
        </div>
      )}
      {!loading && !error && (
        <DiscussionLoadMore
          remaining={remaining}
          loading={loadingMore}
          label="Ещё комментарии"
          onLoadMore={loadMore}
        />
      )}

      {sheetOpen && replyTarget && replyScrollTailPx > 0 && (
        <div className={styles.replyScrollTail} style={{ height: replyScrollTailPx }} aria-hidden />
      )}

      <div ref={anchorRef} className={styles.composerAnchor}>
        {showDock && (
          <div ref={dockRef} className={styles.composerDock}>
            <MessageComposer
              replyingTo={replyTarget ? messageAuthorName(replyTarget) : null}
              onCancelReply={() => setReplyTarget(null)}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>

      {!currentAccountId && (
        <p className={styles.muted}>
          <Link
            to="/login"
            state={{ from: `${location.pathname}${location.search}` }}
            className={styles.loginLink}
          >
            Войдите
          </Link>
          , чтобы оставить комментарий
        </p>
      )}

      {currentAccountId && !canComment && (
        <p className={styles.muted}>В этом обсуждении участники могут только читать сообщения</p>
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
