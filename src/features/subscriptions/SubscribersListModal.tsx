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
import {
  fetchOrgSubscriptions,
  unsubscribeFromOrganization,
  updateOrgSubscriptionNotify,
  getOrganizationAvatar,
  type IOrgSubscriptionItem,
} from '@/entities/organization';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { UserChip } from '@/entities/user/ui/UserChip';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { formatPeopleCount } from '@/shared/lib/plural.ru';
import styles from './SubscribersListModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import { SubscribeModal } from './SubscribeModal';
import { AddSubscriptionModal } from './AddSubscriptionModal';

const PAGE_SIZE = 20;

type ListRow =
  | { kind: 'user'; item: ISubscriptionItem }
  | { kind: 'organization'; item: IOrgSubscriptionItem; logoId: string | null };

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
  const [items,       setItems]       = useState<ListRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [pendingUnsubscribes, setPendingUnsubscribes] = useState<Set<string>>(new Set());
  const [settingsTarget, setSettingsTarget] = useState<ListRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const settingsTargetRef = useRef<ListRow | null>(null);
  settingsTargetRef.current = settingsTarget;
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);
  const includeOrgs = listType === 'subscriptions';

  const loadPage = useCallback(async (pageIndex: number, append: boolean) => {
    if (listType === 'subscribers') {
      const data = await fetchSubscribers(accountId, {
        name: debouncedSearch || undefined,
        pageIndex,
        pageSize: PAGE_SIZE,
      });
      const rows: ListRow[] = data.items.map(item => ({ kind: 'user', item }));
      setItems(prev => (append ? [...prev, ...rows] : rows));
      setTotal(data.total);
      return;
    }

    // Подписки: пользователи + организации (объединённый список)
    const [users, orgs] = await Promise.all([
      fetchSubscriptions(accountId, {
        name: debouncedSearch || undefined,
        pageIndex,
        pageSize: PAGE_SIZE,
      }),
      fetchOrgSubscriptions(accountId, {
        name: debouncedSearch || undefined,
        pageIndex,
        pageSize: PAGE_SIZE,
      }),
    ]);

    const logos = await Promise.all(
      orgs.items.map(async o => {
        const id = o.organization?.id;
        if (!id) return [id ?? '', null] as const;
        const logo = await getOrganizationAvatar(id).catch(() => null);
        return [id, logo] as const;
      }),
    );
    const logoMap = Object.fromEntries(logos);

    const userRows: ListRow[] = users.items.map(item => ({ kind: 'user', item }));
    const orgRows: ListRow[] = orgs.items
      .filter(item => item.organization)
      .map(item => ({
        kind: 'organization' as const,
        item,
        logoId: logoMap[item.organization!.id] ?? null,
      }));

    // На каждой странице чередуем: сначала пользователи страницы, затем организации.
    const rows = [...userRows, ...orgRows];
    setItems(prev => (append ? [...prev, ...rows] : rows));
    setTotal(users.total + orgs.total);
  }, [accountId, debouncedSearch, listType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(0);
    loadPage(0, false)
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      await loadPage(nextPage, true);
      setPage(nextPage);
    } finally { setLoadingMore(false); }
  }, [loadingMore, items.length, total, page, loadPage]);

  const sentinelRef = useInfiniteScroll(loadMore);

  const rowKey = (row: ListRow) => (
    row.kind === 'user'
      ? `u:${row.item.account.id}`
      : `o:${row.item.organization!.id}`
  );

  const handleClose = useCallback(async () => {
    if (pendingUnsubscribes.size > 0) {
      const ids = [...pendingUnsubscribes];
      for (const key of ids) {
        try {
          if (key.startsWith('o:')) {
            // eslint-disable-next-line no-await-in-loop
            await unsubscribeFromOrganization(key.slice(2));
          } else if (key.startsWith('u:')) {
            // eslint-disable-next-line no-await-in-loop
            await unsubscribe(key.slice(2));
          }
        } catch {
          // Игнорируем частичные ошибки, чтобы окно корректно закрылось
        }
      }
    }
    onClose();
  }, [onClose, pendingUnsubscribes]);

  const togglePendingUnsubscribe = useCallback((key: string) => {
    setPendingUnsubscribes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const saveSettings = useCallback(async (settings: INotifySettings) => {
    if (!settingsTarget) return;
    if (settingsTarget.kind === 'user') {
      await updateSubscriptionNotify(settingsTarget.item.account.id, settings);
      setItems(prev => prev.map(row => (
        row.kind === 'user' && row.item.account.id === settingsTarget.item.account.id
          ? { ...row, item: { ...row.item, notifySettings: settings } }
          : row
      )));
    } else {
      const orgId = settingsTarget.item.organization!.id;
      await updateOrgSubscriptionNotify(orgId, { notifyEventCreated: settings.notifyEventCreated });
      setItems(prev => prev.map(row => (
        row.kind === 'organization' && row.item.organization?.id === orgId
          ? {
              ...row,
              item: {
                ...row.item,
                notifySettings: { notifyEventCreated: settings.notifyEventCreated },
              },
            }
          : row
      )));
    }
    setSettingsTarget(null);
  }, [settingsTarget]);

  const canManageSubscriptions = listType === 'subscriptions' && accountId === currentAccountId;

  const addModalOpenRef = useRef(false);
  addModalOpenRef.current = showAddModal;

  const handleModalBack = useCallback(() => {
    if (settingsTargetRef.current) setSettingsTarget(null);
    else if (addModalOpenRef.current) setShowAddModal(false);
    else void handleClose();
  }, [handleClose]);

  useModalBackButton(handleModalBack);

  useEffect(() => {
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
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>{title}</h3>
            {!loading && <span className={styles.count}>{formatPeopleCount(total)}</span>}
          </div>
          <div className={styles.headerActions}>
            {canManageSubscriptions && (
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => setShowAddModal(true)}
              >
                Добавить
              </button>
            )}
            <button className={styles.closeBtn} onClick={() => { void handleClose(); }}>✕</button>
          </div>
        </div>

        <div className={styles.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder={includeOrgs ? 'Поиск по имени, логину или организации...' : 'Поиск по имени или логину...'}
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
          {items.map(row => {
            const key = rowKey(row);
            if (row.kind === 'user') {
              const item = row.item;
              return (
                <div
                  key={key}
                  className={`${styles.row} ${pendingUnsubscribes.has(key) ? styles.rowPending : ''}`}
                >
                  <button
                    type="button"
                    className={styles.rowMain}
                    onClick={() => {
                      navigate(`/user/${item.account.id}`);
                      void handleClose();
                    }}
                  >
                    <UserChip
                      user={{
                        accountId: item.account.id,
                        login:     item.account.login,
                        avatarId:  item.account.avatarId,
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
                          setSettingsTarget(row);
                        }}
                        disabled={pendingUnsubscribes.has(key)}
                        aria-label="Настройки уведомлений"
                        title="Настройки уведомлений"
                      >
                        <SettingsGearIcon />
                      </button>
                      <button
                        type="button"
                        className={pendingUnsubscribes.has(key) ? styles.undoBtn : styles.unsubscribeBtn}
                        onClick={() => togglePendingUnsubscribe(key)}
                      >
                        {pendingUnsubscribes.has(key) ? 'Отменить' : 'Отписаться'}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const org = row.item.organization!;
            const initials = org.name.slice(0, 2).toUpperCase() || 'ОР';
            return (
              <div
                key={key}
                className={`${styles.row} ${pendingUnsubscribes.has(key) ? styles.rowPending : ''}`}
              >
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => {
                    navigate(`/organization/${org.id}`);
                    void handleClose();
                  }}
                >
                  <div className={styles.orgChip}>
                    <div className={styles.orgAvatar}>
                      {row.logoId ? (
                        <AuthImage
                          fileId={row.logoId}
                          alt=""
                          className={styles.orgAvatarImg}
                          fallback={<span>{initials}</span>}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className={styles.orgText}>
                      <span className={styles.orgName}>{org.name}</span>
                      <span className={styles.orgMeta}>Организация</span>
                    </div>
                  </div>
                </button>
                {canManageSubscriptions && (
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.settingsBtn}
                      onClick={e => {
                        e.stopPropagation();
                        setSettingsTarget(row);
                      }}
                      disabled={pendingUnsubscribes.has(key)}
                      aria-label="Настройки уведомлений"
                      title="Настройки уведомлений"
                    >
                      <SettingsGearIcon />
                    </button>
                    <button
                      type="button"
                      className={pendingUnsubscribes.has(key) ? styles.undoBtn : styles.unsubscribeBtn}
                      onClick={() => togglePendingUnsubscribe(key)}
                    >
                      {pendingUnsubscribes.has(key) ? 'Отменить' : 'Отписаться'}
                    </button>
                  </div>
                )}
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
      {settingsTarget?.kind === 'user' && (
        <SubscribeModal
          stacked
          targetLogin={settingsTarget.item.account.login}
          targetAccountId={settingsTarget.item.account.id}
          targetAvatarId={settingsTarget.item.account.avatarId ?? null}
          initialSettings={settingsTarget.item.notifySettings ?? undefined}
          title={`Настройки уведомлений @${settingsTarget.item.account.login}`}
          subtitle="Выберите уведомления, которые хотите получать от пользователя:"
          confirmLabel="Сохранить"
          onConfirm={saveSettings}
          onCancel={() => setSettingsTarget(null)}
        />
      )}
      {settingsTarget?.kind === 'organization' && settingsTarget.item.organization && (
        <SubscribeModal
          stacked
          variant="organization"
          targetLogin={settingsTarget.item.organization.name}
          organizationLogoId={settingsTarget.logoId}
          initialSettings={{
            notifyEventCreated: settingsTarget.item.notifySettings?.notifyEventCreated ?? true,
          }}
          title={`Настройки уведомлений — ${settingsTarget.item.organization.name}`}
          subtitle="Выберите уведомления, которые хотите получать от организации:"
          confirmLabel="Сохранить"
          onConfirm={saveSettings}
          onCancel={() => setSettingsTarget(null)}
        />
      )}
      {showAddModal && (
        <AddSubscriptionModal
          onClose={() => setShowAddModal(false)}
          onBeforeNavigate={handleClose}
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
