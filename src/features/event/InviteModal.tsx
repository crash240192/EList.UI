// features/event/InviteModal.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchSubscribers } from '@/entities/user/subscriptionApi';
import type { ISubscriptionItem } from '@/entities/user/subscriptionApi';
import {
  createInvitations,
  fetchCanInviteToEventByEvent,
  type IInviteToEventEligibility,
} from '@/entities/invitation/invitationsApi';
import {
  getBWListShortIds,
  canInviteSubscriber,
  inviteBlockReason,
} from '@/entities/event/participationApi';
import { fetchCanInviteBatch, type ICanInviteResult } from '@/entities/user/privacyApi';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatSubscribersCount } from '@/shared/lib/plural.ru';
import styles from './InviteModal.module.css';

const PAGE_SIZE = 20;

interface InviteModalProps {
  /** Обязателен в режиме отправки приглашений (страница события) */
  eventId?: string;
  currentAccountId: string;
  /**
   * Организация-организатор мероприятия.
   * Если задана — приглашение уходит от имени организации (InviterOrganizationId).
   */
  inviterOrganizationId?: string | null;
  /** Закрытое мероприятие — белый список; открытое — чёрный */
  isPrivate?: boolean;
  onClose: () => void;
  onSent?: (count: number) => void;
  /** Выбор подписчиков до создания события (без API invitations) */
  pickMode?: boolean;
  initialSelectedIds?: string[];
  onPickConfirm?: (accountIds: string[]) => void;
  /** Локальные Б/Ч списки при создании события — без запроса short */
  draftBlackListIds?: string[];
  draftWhiteListIds?: string[];
}

function getInitials(p: ISubscriptionItem): string {
  const pi = p.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return p.account.login[0].toUpperCase();
}

function mergeEligibility(
  prev: Map<string, IInviteToEventEligibility>,
  rows: IInviteToEventEligibility[],
): Map<string, IInviteToEventEligibility> {
  const next = new Map(prev);
  for (const row of rows) next.set(row.accountId, row);
  return next;
}

export function InviteModal({
  eventId,
  currentAccountId,
  inviterOrganizationId = null,
  isPrivate = false,
  onClose,
  onSent,
  pickMode = false,
  initialSelectedIds,
  onPickConfirm,
  draftBlackListIds,
  draftWhiteListIds,
}: InviteModalProps) {
  useModalBackButton(onClose);

  /** Полная eligibility с сервера (age/gender/privacy/BL/WL) — только когда событие уже есть */
  const useEventEligibility = Boolean(eventId) && !pickMode;

  const [search, setSearch] = useState('');
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [blackListIds, setBlackListIds] = useState<Set<string>>(new Set());
  const [whiteListIds, setWhiteListIds] = useState<Set<string>>(new Set());
  const [privacyById, setPrivacyById] = useState<Map<string, ICanInviteResult>>(() => new Map());
  const [eligibilityById, setEligibilityById] = useState<Map<string, IInviteToEventEligibility>>(
    () => new Map(),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    // В режиме отправки eligibility уже включает BL/WL — локальные short-листы не нужны.
    if (useEventEligibility) {
      setBlackListIds(new Set());
      setWhiteListIds(new Set());
      return;
    }
    if (draftBlackListIds !== undefined || draftWhiteListIds !== undefined) {
      setBlackListIds(new Set(draftBlackListIds ?? []));
      setWhiteListIds(new Set(draftWhiteListIds ?? []));
      return;
    }
    if (!eventId) {
      setBlackListIds(new Set());
      setWhiteListIds(new Set());
      return;
    }
    let cancelled = false;
    void Promise.all([
      getBWListShortIds('blackList', eventId).catch(() => [] as string[]),
      getBWListShortIds('whiteList', eventId).catch(() => [] as string[]),
    ]).then(([black, white]) => {
      if (cancelled) return;
      setBlackListIds(new Set(black));
      setWhiteListIds(new Set(white));
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, draftBlackListIds, draftWhiteListIds, useEventEligibility]);

  useEffect(() => {
    if (!pickMode || !initialSelectedIds?.length) return;
    setSelected(new Set(initialSelectedIds));
  }, [pickMode, initialSelectedIds]);

  const loadEligibilityForIds = useCallback(
    async (ids: string[]): Promise<Map<string, IInviteToEventEligibility>> => {
      if (!useEventEligibility || !eventId || ids.length === 0) return new Map();
      const rows = await fetchCanInviteToEventByEvent({
        eventId,
        accountIds: ids,
        inviterOrganizationId,
      }).catch(() => [] as IInviteToEventEligibility[]);
      const map = new Map<string, IInviteToEventEligibility>();
      for (const row of rows) map.set(row.accountId, row);
      return map;
    },
    [useEventEligibility, eventId, inviterOrganizationId],
  );

  const canInvite = useCallback(
    (accountId: string) => {
      if (useEventEligibility) {
        const el = eligibilityById.get(accountId);
        if (el) return el.allowed;
        // Пока нет ответа — не даём выбрать (избегаем ложного allow).
        return false;
      }
      if (!canInviteSubscriber(isPrivate, accountId, blackListIds, whiteListIds)) return false;
      const privacy = privacyById.get(accountId);
      if (privacy && privacy.allowed === false) return false;
      return true;
    },
    [
      useEventEligibility,
      eligibilityById,
      isPrivate,
      blackListIds,
      whiteListIds,
      privacyById,
    ],
  );

  const blockReasonFor = useCallback(
    (accountId: string): string | null => {
      if (useEventEligibility) {
        const el = eligibilityById.get(accountId);
        if (el && !el.allowed) return el.reason || 'Нельзя пригласить';
        return null;
      }
      const bw = inviteBlockReason(isPrivate, accountId, blackListIds, whiteListIds);
      if (bw) return bw;
      const privacy = privacyById.get(accountId);
      if (privacy && privacy.allowed === false) {
        return privacy.reason || 'Пользователь ограничил приглашения';
      }
      return null;
    },
    [
      useEventEligibility,
      eligibilityById,
      isPrivate,
      blackListIds,
      whiteListIds,
      privacyById,
    ],
  );

  useEffect(() => {
    setSelected(prev => {
      const next = new Set<string>();
      for (const id of prev) {
        if (canInvite(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [canInvite]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPage(0);
    setEligibilityById(new Map());
    setPrivacyById(new Map());
    fetchSubscribers(currentAccountId, { name: debouncedSearch || undefined, pageIndex: 0, pageSize: PAGE_SIZE })
      .then(async data => {
        if (cancelled) return;
        setSubscribers(data.items);
        setTotal(data.total);
        const ids = data.items.map(s => s.account.id);
        if (useEventEligibility) {
          const map = await loadEligibilityForIds(ids);
          if (!cancelled) setEligibilityById(map);
        } else {
          const privacy = await fetchCanInviteBatch(ids).catch(() => new Map<string, ICanInviteResult>());
          if (!cancelled) setPrivacyById(privacy);
        }
      })
      .catch(() => {
        if (!cancelled) setErr('Не удалось загрузить подписчиков');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, currentAccountId, useEventEligibility, loadEligibilityForIds]);

  const loadMore = useCallback(async () => {
    if (loadingMore || subscribers.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchSubscribers(currentAccountId, {
        name: debouncedSearch || undefined,
        pageIndex: nextPage,
        pageSize: PAGE_SIZE,
      });
      setSubscribers(prev => [...prev, ...data.items]);
      setPage(nextPage);
      const ids = data.items.map(s => s.account.id);
      if (useEventEligibility) {
        const map = await loadEligibilityForIds(ids);
        setEligibilityById(prev => mergeEligibility(prev, [...map.values()]));
      } else {
        const privacy = await fetchCanInviteBatch(ids).catch(() => new Map<string, ICanInviteResult>());
        setPrivacyById(prev => {
          const next = new Map(prev);
          for (const [id, value] of privacy) next.set(id, value);
          return next;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    subscribers.length,
    total,
    page,
    debouncedSearch,
    currentAccountId,
    useEventEligibility,
    loadEligibilityForIds,
  ]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    setTimeout(() => searchRef.current?.select?.(), 200);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const inviteableOnPage = useMemo(
    () => subscribers.filter(s => canInvite(s.account.id)),
    [subscribers, canInvite],
  );

  const toggleSelect = (accountId: string) => {
    if (!canInvite(accountId)) return;
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(accountId)) n.delete(accountId);
      else n.add(accountId);
      return n;
    });
  };

  const allInviteableSelected =
    inviteableOnPage.length > 0 && inviteableOnPage.every(s => selected.has(s.account.id));

  const selectAll = () => {
    setSelected(prev => {
      const n = new Set(prev);
      for (const s of inviteableOnPage) n.add(s.account.id);
      return n;
    });
  };

  const clearAll = () => setSelected(new Set());

  const handleConfirm = async () => {
    const ids = [...selected].filter(id => canInvite(id));
    if (ids.length === 0) return;

    if (pickMode) {
      onPickConfirm?.(ids);
      onClose();
      return;
    }

    if (!eventId) return;

    setSending(true);
    setErr(null);
    try {
      await createInvitations({
        accountIds: ids,
        eventId,
        inviterAccountId: currentAccountId,
        ...(inviterOrganizationId
          ? { inviterOrganizationId }
          : {}),
      });
      setSent(true);
      onSent?.(ids.length);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Пригласить">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>{pickMode ? 'Кого пригласить' : 'Пригласить'}</h3>
            {!loading && <span className={styles.count}>{formatSubscribersCount(total)}</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.searchWrap}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={styles.searchIcon}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            className={styles.searchInput}
            onFocus={e => e.currentTarget.select()}
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className={styles.searchClear} onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

        {!loading && subscribers.length > 0 && (
          <div className={styles.selectAllRow}>
            <span className={styles.selectedCount}>
              {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Никто не выбран'}
            </span>
            {inviteableOnPage.length > 0 && (
              <button type="button" className={styles.selectAllBtn} onClick={allInviteableSelected ? clearAll : selectAll}>
                {allInviteableSelected ? 'Снять все' : 'Выбрать доступных'}
              </button>
            )}
          </div>
        )}

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err && subscribers.length === 0 ? (
            <div className={styles.empty} style={{ color: 'var(--danger)' }}>
              {err}
            </div>
          ) : subscribers.length === 0 ? (
            <div className={styles.empty}>{search ? 'Никого не найдено' : 'Нет подписчиков'}</div>
          ) : (
            <>
              {subscribers.map(s => {
                const id = s.account.id;
                const allowed = canInvite(id);
                const blockedReason = blockReasonFor(id);
                const isSelected = selected.has(id);

                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={allowed ? 0 : -1}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''} ${!allowed ? styles.itemBlocked : ''}`}
                    title={blockedReason ?? undefined}
                    onClick={() => toggleSelect(id)}
                    onKeyDown={e => {
                      if (allowed && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggleSelect(id);
                      }
                    }}
                  >
                    <div className={`${styles.checkbox} ${!allowed ? styles.checkboxDisabled : ''}`}>
                      {isSelected && allowed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className={styles.ava}>
                      <UserAvatar accountId={id} avatarId={s.account.avatarId ?? null} initials={getInitials(s)} size={34} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        {s.personInfo?.firstName
                          ? `${s.personInfo.firstName} ${s.personInfo.lastName ?? ''}`.trim()
                          : s.account.login}
                      </div>
                      <div className={styles.login}>
                        {blockedReason ? blockedReason : `@${s.account.login}`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {subscribers.length < total && (
                <div ref={sentinelRef} className={styles.loadMore}>
                  {loadingMore ? 'Загрузка...' : `Ещё ${total - subscribers.length}`}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {err && !loading && <span className={styles.footerErr}>{err}</span>}
          {sent && !pickMode ? (
            <div className={styles.sentMsg}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Приглашения отправлены!
            </div>
          ) : (
            <>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={sending}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={() => void handleConfirm()}
                disabled={selected.size === 0 || sending}
              >
                {sending
                  ? 'Отправка...'
                  : pickMode
                    ? `Сохранить${selected.size > 0 ? ` (${selected.size})` : ''}`
                    : `Пригласить${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
