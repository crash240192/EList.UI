// Выбор получателя подарка: подписчики + подписки + lookup по логину/id.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchSubscribers,
  fetchSubscriptions,
  type ISubscriptionItem,
} from '@/entities/user/subscriptionApi';
import { lookupAccount, type IAccountLookup } from '@/entities/user/accountLookupApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatSubscribersCount } from '@/shared/lib/plural.ru';
import styles from '@/features/event/InviteModal.module.css';

const PAGE_SIZE = 20;

type RecipientRow = {
  accountId: string;
  login: string;
  avatarId: string | null;
  firstName: string | null;
  lastName: string | null;
  source: 'subscriber' | 'subscription' | 'lookup';
};

function toRow(item: ISubscriptionItem, source: RecipientRow['source']): RecipientRow {
  return {
    accountId: item.account.id,
    login: item.account.login,
    avatarId: item.account.avatarId ?? null,
    firstName: item.personInfo?.firstName ?? null,
    lastName: item.personInfo?.lastName ?? null,
    source,
  };
}

function fromLookup(a: IAccountLookup): RecipientRow {
  return {
    accountId: a.id,
    login: a.login,
    avatarId: a.avatarId,
    firstName: a.firstName,
    lastName: a.lastName,
    source: 'lookup',
  };
}

function getInitials(r: RecipientRow): string {
  if (r.firstName) return `${r.firstName[0]}${r.lastName?.[0] ?? ''}`.toUpperCase();
  return r.login[0]?.toUpperCase() ?? '?';
}

function displayName(r: RecipientRow): string {
  const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  return name || r.login;
}

interface GiftRecipientModalProps {
  currentAccountId: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (accountId: string, label: string) => void;
}

export function GiftRecipientModal({
  currentAccountId,
  busy = false,
  onClose,
  onConfirm,
}: GiftRecipientModalProps) {
  useModalBackButton(onClose);

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);

  const mergeUnique = useCallback((lists: RecipientRow[][]) => {
    const map = new Map<string, RecipientRow>();
    for (const list of lists) {
      for (const row of list) {
        if (!row.accountId || row.accountId === currentAccountId) continue;
        if (!map.has(row.accountId)) map.set(row.accountId, row);
      }
    }
    return [...map.values()];
  }, [currentAccountId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPage(0);
    Promise.all([
      fetchSubscribers(currentAccountId, {
        name: debouncedSearch || undefined,
        pageIndex: 0,
        pageSize: PAGE_SIZE,
      }),
      fetchSubscriptions(currentAccountId, {
        name: debouncedSearch || undefined,
        pageIndex: 0,
        pageSize: PAGE_SIZE,
      }),
    ])
      .then(([subs, following]) => {
        if (cancelled) return;
        const merged = mergeUnique([
          subs.items.map(i => toRow(i, 'subscriber')),
          following.items.map(i => toRow(i, 'subscription')),
        ]);
        setRows(merged);
        setTotal(Math.max(subs.total, following.total, merged.length));
      })
      .catch(() => {
        if (!cancelled) setErr('Не удалось загрузить список');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, currentAccountId, mergeUnique]);

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const [subs, following] = await Promise.all([
        fetchSubscribers(currentAccountId, {
          name: debouncedSearch || undefined,
          pageIndex: nextPage,
          pageSize: PAGE_SIZE,
        }),
        fetchSubscriptions(currentAccountId, {
          name: debouncedSearch || undefined,
          pageIndex: nextPage,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setRows(prev => mergeUnique([
        prev,
        subs.items.map(i => toRow(i, 'subscriber')),
        following.items.map(i => toRow(i, 'subscription')),
      ]));
      setPage(nextPage);
      setTotal(Math.max(subs.total, following.total));
    } catch {
      setErr('Не удалось догрузить список');
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore, rows.length, total, page, debouncedSearch,
    currentAccountId, mergeUnique,
  ]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: !loading && !loadingMore && rows.length < total,
  });

  const selected = useMemo(
    () => rows.find(r => r.accountId === selectedId) ?? null,
    [rows, selectedId],
  );

  const handleLookup = async () => {
    const q = search.trim();
    if (!q || lookupBusy || busy) return;
    setLookupBusy(true);
    setErr(null);
    try {
      const found = await lookupAccount(q);
      const row = fromLookup(found);
      setRows(prev => mergeUnique([[row], prev]));
      setSelectedId(row.accountId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Аккаунт не найден');
    } finally {
      setLookupBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!selected || busy) return;
    onConfirm(selected.accountId, displayName(selected));
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={busy ? undefined : onClose} aria-hidden />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Подарить билет"
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>Подарить билет</h2>
            {!loading && (
              <span className={styles.count}>{formatSubscribersCount(rows.length)}</span>
            )}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={busy}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <p className={styles.empty} style={{ padding: '8px 16px 0', textAlign: 'left' }}>
          Подписчики, подписки или поиск по логину / id. Владелец билета сменится,
          покупатель заказа останется прежним.
        </p>

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
            placeholder="Имя, логин или id…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleLookup();
              }
            }}
            disabled={busy}
          />
          {search && (
            <button type="button" className={styles.searchClear} onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <button
            type="button"
            className={styles.cancelBtn}
            style={{ width: '100%' }}
            disabled={!search.trim() || lookupBusy || busy}
            onClick={() => { void handleLookup(); }}
          >
            {lookupBusy ? 'Поиск…' : 'Найти по логину / id'}
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err && rows.length === 0 ? (
            <div className={styles.empty} style={{ color: 'var(--danger)' }}>
              {err}
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'Никого не найдено — попробуйте «Найти по логину / id»' : 'Нет контактов'}
            </div>
          ) : (
            <>
              {rows.map(r => {
                const isSelected = selectedId === r.accountId;
                return (
                  <div
                    key={r.accountId}
                    role="button"
                    tabIndex={0}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                    onClick={() => setSelectedId(r.accountId)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(r.accountId);
                      }
                    }}
                  >
                    <div className={styles.checkbox}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className={styles.ava}>
                      <UserAvatar
                        accountId={r.accountId}
                        avatarId={r.avatarId}
                        initials={getInitials(r)}
                        size={34}
                      />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{displayName(r)}</div>
                      <div className={styles.login}>@{r.login}</div>
                    </div>
                  </div>
                );
              })}
              {rows.length < total && (
                <div ref={sentinelRef} className={styles.loadMore}>
                  {loadingMore ? 'Загрузка...' : `Ещё ${Math.max(0, total - rows.length)}`}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {err && !loading && rows.length > 0 && (
            <span className={styles.footerErr}>{err}</span>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.sendBtn}
            disabled={!selectedId || busy}
            onClick={handleConfirm}
          >
            {busy ? '…' : 'Передать'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
