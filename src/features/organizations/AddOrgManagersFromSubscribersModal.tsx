// Выбор менеджеров организации из подписчиков текущего пользователя

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchSubscribers, type ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatSubscribersCount } from '@/shared/lib/plural.ru';
import styles from '@/features/event/InviteModal.module.css';

const PAGE_SIZE = 20;

interface Props {
  currentAccountId: string;
  existingMemberIds: ReadonlySet<string>;
  onClose: () => void;
  onConfirm: (accountIds: string[]) => void;
}

function getInitials(p: ISubscriptionItem): string {
  const pi = p.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return p.account.login[0]?.toUpperCase() ?? '?';
}

function displayName(p: ISubscriptionItem): string {
  const name = `${p.personInfo?.firstName ?? ''} ${p.personInfo?.lastName ?? ''}`.trim();
  return name || p.account.login;
}

export function AddOrgManagersFromSubscribersModal({
  currentAccountId,
  existingMemberIds,
  onClose,
  onConfirm,
}: Props) {
  useModalBackButton(onClose);

  const [search, setSearch] = useState('');
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPage(0);
    fetchSubscribers(currentAccountId, {
      name: debouncedSearch || undefined,
      pageIndex: 0,
      pageSize: PAGE_SIZE,
    })
      .then(data => {
        if (cancelled) return;
        setSubscribers(data.items);
        setTotal(data.total);
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
  }, [debouncedSearch, currentAccountId]);

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
      setSubscribers(prev => {
        const seen = new Set(prev.map(s => s.account.id));
        const extra = data.items.filter(s => !seen.has(s.account.id));
        return extra.length ? [...prev, ...extra] : prev;
      });
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, subscribers.length, total, page, debouncedSearch, currentAccountId]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: !loading && !loadingMore && subscribers.length < total,
  });

  useEffect(() => {
    const t = window.setTimeout(() => searchRef.current?.focus(), 200);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const selectable = useMemo(
    () => subscribers.filter(s => !existingMemberIds.has(s.account.id)),
    [subscribers, existingMemberIds],
  );

  const toggleSelect = (id: string) => {
    if (existingMemberIds.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectable.length > 0 && selectable.every(s => selected.has(s.account.id));
  const selectAll = () => setSelected(new Set(selectable.map(s => s.account.id)));
  const clearAll = () => setSelected(new Set());

  const handleConfirm = () => {
    const ids = [...selected].filter(id => !existingMemberIds.has(id));
    if (ids.length === 0) return;
    onConfirm(ids);
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Добавить из подписок">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Добавить из подписок</h3>
            {!loading && <span className={styles.count}>{formatSubscribersCount(total)}</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
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

        {!loading && selectable.length > 0 && (
          <div className={styles.selectAllRow}>
            <span className={styles.selectedCount}>
              {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Никто не выбран'}
            </span>
            <button type="button" className={styles.selectAllBtn} onClick={allSelected ? clearAll : selectAll}>
              {allSelected ? 'Снять все' : 'Выбрать всех'}
            </button>
          </div>
        )}

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err && subscribers.length === 0 ? (
            <div className={styles.empty} style={{ color: 'var(--danger)' }}>{err}</div>
          ) : subscribers.length === 0 ? (
            <div className={styles.empty}>{search ? 'Никого не найдено' : 'Нет подписчиков для добавления'}</div>
          ) : (
            <>
              {subscribers.map(s => {
                const isExisting = existingMemberIds.has(s.account.id);
                const isChecked = selected.has(s.account.id);
                return (
                  <div
                    key={s.account.id}
                    className={`${styles.item} ${isChecked ? styles.itemSelected : ''} ${isExisting ? styles.itemDisabled : ''}`}
                    onClick={() => toggleSelect(s.account.id)}
                  >
                    <div className={styles.checkbox}>
                      {isExisting ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}>
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="16 8 11 14 8 11" />
                        </svg>
                      ) : isChecked ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </div>
                    <div className={styles.ava}>
                      <UserAvatar
                        accountId={s.account.id}
                        avatarId={s.account.avatarId ?? null}
                        initials={getInitials(s)}
                        size={34}
                      />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{displayName(s)}</div>
                      <div className={styles.login}>@{s.account.login}</div>
                    </div>
                    {isExisting && <span className={styles.orgBadge}>В команде</span>}
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
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button
            type="button"
            className={styles.sendBtn}
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            Выбрать{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
