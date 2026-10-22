// features/subscriptions/OrgSubscribersListModal.tsx
// Список подписчиков организации (только люди; у организации нет своих «подписок»)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchOrgSubscribers,
  type IOrgSubscriptionItem,
} from '@/entities/organization';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { UserChip } from '@/entities/user/ui/UserChip';
import { formatPeopleCount } from '@/shared/lib/plural.ru';
import styles from './SubscribersListModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

const PAGE_SIZE = 20;

interface Props {
  organizationId: string;
  currentAccountId: string | null;
  onClose: () => void;
}

export function OrgSubscribersListModal({
  organizationId,
  currentAccountId,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<IOrgSubscriptionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(search, 350);

  useModalBackButton(onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(0);
    fetchOrgSubscribers(organizationId, {
      name: debouncedSearch || undefined,
      pageIndex: 0,
      pageSize: PAGE_SIZE,
    })
      .then(data => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, organizationId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchOrgSubscribers(organizationId, {
        name: debouncedSearch || undefined,
        pageIndex: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems(prev => [...prev, ...data.items]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, items.length, total, page, debouncedSearch, organizationId]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Подписчики</h3>
            {!loading && <span className={styles.count}>{formatPeopleCount(total)}</span>}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.state}>Загрузка...</p>}
          {error && <p className={styles.stateError}>{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className={styles.state}>{search ? 'Никого не найдено' : 'Список пуст'}</p>
          )}
          {items.map(item => {
            const account = item.account;
            if (!account) return null;
            return (
              <div key={account.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => {
                    navigate(`/user/${account.id}`);
                    onClose();
                  }}
                >
                  <UserChip
                    user={{
                      accountId: account.id,
                      login: account.login,
                      avatarId: account.avatarId,
                      firstName: item.personInfo?.firstName ?? null,
                      lastName: item.personInfo?.lastName ?? null,
                      isMe: account.id === currentAccountId,
                    }}
                    clickable={false}
                    size="md"
                  />
                </button>
              </div>
            );
          })}
          {!loading && items.length < total && (
            <div ref={sentinelRef} className={styles.loadMore}>
              {loadingMore ? 'Загрузка...' : `Показать ещё (${total - items.length})`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
