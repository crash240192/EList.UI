// Выбор одного получателя подарка из подписчиков текущего пользователя.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchSubscribers, type ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { formatSubscribersCount } from '@/shared/lib/plural.ru';
import styles from '@/features/event/InviteModal.module.css';

const PAGE_SIZE = 20;

function getInitials(p: ISubscriptionItem): string {
  const pi = p.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return p.account.login[0]?.toUpperCase() ?? '?';
}

function displayName(p: ISubscriptionItem): string {
  const name = `${p.personInfo?.firstName ?? ''} ${p.personInfo?.lastName ?? ''}`.trim();
  return name || p.account.login;
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
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      setSubscribers(prev => [...prev, ...data.items]);
      setPage(nextPage);
      setTotal(data.total);
    } catch {
      setErr('Не удалось догрузить подписчиков');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, subscribers.length, total, page, debouncedSearch, currentAccountId]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: !loading && !loadingMore && subscribers.length < total,
  });

  const selected = subscribers.find(s => s.account.id === selectedId) ?? null;

  const handleConfirm = () => {
    if (!selected || busy) return;
    onConfirm(selected.account.id, displayName(selected));
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
              <span className={styles.count}>{formatSubscribersCount(total)}</span>
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
          Выберите получателя из ваших подписчиков. Владелец билета сменится, покупатель заказа останется прежним.
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
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={busy}
          />
          {search && (
            <button type="button" className={styles.searchClear} onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>

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
                const isSelected = selectedId === id;
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                    onClick={() => setSelectedId(id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(id);
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
                      <UserAvatar accountId={id} avatarId={s.account.avatarId ?? null} initials={getInitials(s)} size={34} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{displayName(s)}</div>
                      <div className={styles.login}>@{s.account.login}</div>
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
          {err && !loading && subscribers.length > 0 && (
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
