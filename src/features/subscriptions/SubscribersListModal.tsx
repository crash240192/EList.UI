// features/subscriptions/SubscribersListModal.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { INotifySettings, ISubscriptionItem } from '@/entities/user/subscriptionApi';
import {
  fetchSubscriptions,
  fetchSubscribers,
  unsubscribe,
  updateSubscriptionNotify,
} from '@/entities/user/subscriptionApi';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { UserChip } from '@/entities/user/ui/UserChip';
import styles from './SubscribersListModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { SubscribeModal } from './SubscribeModal';

const PAGE_SIZE = 20;

interface Props {
  title: string;
  accountId: string;
  listType: 'subscriptions' | 'subscribers';
  currentAccountId: string | null;
  onClose: () => void;
}

export function SubscribersListModal({ title, accountId, listType, currentAccountId, onClose }: Props) {
  const navigate = useNavigate();

  const [search,      setSearch]      = useState('');
  const [items,       setItems]       = useState<ISubscriptionItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [pendingUnsubscribes, setPendingUnsubscribes] = useState<Set<string>>(new Set());
  const [settingsTarget, setSettingsTarget] = useState<ISubscriptionItem | null>(null);
  const settingsTargetRef = useRef<ISubscriptionItem | null>(null);
  settingsTargetRef.current = settingsTarget;
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);
  const fetchFn = listType === 'subscriptions' ? fetchSubscriptions : fetchSubscribers;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(0);
    fetchFn(accountId, { name: debouncedSearch || undefined, pageIndex: 0, pageSize: PAGE_SIZE })
      .then(data => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, accountId, listType]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await fetchFn(accountId, {
        name: debouncedSearch || undefined,
        pageIndex: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems(prev => [...prev, ...data.items]);
      setPage(nextPage);
    } finally { setLoadingMore(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, items.length, total, page, debouncedSearch, accountId, listType]);

  const sentinelRef = useInfiniteScroll(loadMore);

  const handleClose = useCallback(async () => {
    if (pendingUnsubscribes.size > 0) {
      const ids = [...pendingUnsubscribes];
      for (const id of ids) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await unsubscribe(id);
        } catch {
          // Игнорируем частичные ошибки, чтобы окно корректно закрылось
        }
      }
    }
    onClose();
  }, [onClose, pendingUnsubscribes]);

  const togglePendingUnsubscribe = useCallback((accountIdToToggle: string) => {
    setPendingUnsubscribes(prev => {
      const next = new Set(prev);
      if (next.has(accountIdToToggle)) next.delete(accountIdToToggle);
      else next.add(accountIdToToggle);
      return next;
    });
  }, []);

  const openSettings = useCallback((item: ISubscriptionItem) => {
    setSettingsTarget(item);
  }, []);

  const saveSettings = useCallback(async (settings: INotifySettings) => {
    if (!settingsTarget) return;
    await updateSubscriptionNotify(settingsTarget.account.id, settings);
    setItems(prev => prev.map(i => i.account.id === settingsTarget.account.id
      ? { ...i, notifySettings: settings }
      : i));
    setSettingsTarget(null);
  }, [settingsTarget]);

  const canManageSubscriptions = listType === 'subscriptions' && accountId === currentAccountId;

  const handleModalBack = useCallback(() => {
    if (settingsTargetRef.current) setSettingsTarget(null);
    else void handleClose();
  }, [handleClose]);

  useModalBackButton(handleModalBack);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100);
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleModalBack();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [handleModalBack]);

  return (
    <>
      <div className={styles.backdrop} onClick={() => { void handleClose(); }} />
      <div className={styles.modal} role="dialog" aria-modal>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            {!loading && <span className={styles.count}>{total}</span>}
          </div>
          <button className={styles.closeBtn} onClick={() => { void handleClose(); }}>✕</button>
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
          {error   && <p className={styles.stateError}>{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className={styles.state}>{search ? 'Никого не найдено' : 'Список пуст'}</p>
          )}
          {items.map(item => (
            <div
              key={item.account.id}
              className={`${styles.row} ${pendingUnsubscribes.has(item.account.id) ? styles.rowPending : ''}`}
            >
              <button
                type="button"
                className={styles.rowMain}
                onClick={() => { void handleClose(); navigate(`/user/${item.account.id}`); }}
              >
                <UserChip
                  user={{
                    accountId: item.account.id,
                    login:     item.account.login,
                    firstName: item.personInfo?.firstName ?? null,
                    lastName:  item.personInfo?.lastName  ?? null,
                    isMe:      item.account.id === currentAccountId,
                  }}
                  clickable={false}
                  size="md"
                />
              </button>
              {canManageSubscriptions && (
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.settingsBtn}
                    onClick={e => {
                      e.stopPropagation();
                      openSettings(item);
                    }}
                    disabled={pendingUnsubscribes.has(item.account.id)}
                    aria-label="Настройки уведомлений"
                    title="Настройки уведомлений"
                  >
                    <SettingsGearIcon />
                  </button>
                  <button
                    type="button"
                    className={pendingUnsubscribes.has(item.account.id) ? styles.undoBtn : styles.unsubscribeBtn}
                    onClick={() => togglePendingUnsubscribe(item.account.id)}
                  >
                    {pendingUnsubscribes.has(item.account.id) ? 'Отменить' : 'Отписаться'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {!loading && items.length < total && (
            <div ref={sentinelRef} className={styles.loadMore}>
              {loadingMore ? 'Загрузка...' : `Показать ещё (${total - items.length})`}
            </div>
          )}
        </div>
      </div>
      {settingsTarget && (
        <SubscribeModal
          stacked
          targetLogin={settingsTarget.account.login}
          initialSettings={settingsTarget.notifySettings ?? undefined}
          title={`Настройки уведомлений @${settingsTarget.account.login}`}
          subtitle="Выберите уведомления, которые хотите получать от пользователя:"
          confirmLabel="Сохранить"
          onConfirm={saveSettings}
          onCancel={() => setSettingsTarget(null)}
        />
      )}
    </>
  );
}

function SettingsGearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
