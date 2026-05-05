// pages/create-event/WhitelistModal.tsx

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchSubscribers } from '@/entities/user/subscriptionApi';
import type { ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import styles from './WhitelistModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

export interface IWhitelistUser {
  accountId: string;
  login: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarFileId?: string | null;
}

interface Props {
  myAccountId: string;
  current: IWhitelistUser[];
  onAdd: (users: IWhitelistUser[]) => void;
  onClose: () => void;
}

function getInitials(s: ISubscriptionItem): string {
  const pi = s.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return s.account.login[0].toUpperCase();
}

export function WhitelistModal({ myAccountId, current, onAdd, onClose }: Props) {
  useModalBackButton(onClose);
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const currentIds = useMemo(() => new Set(current.map(u => u.accountId)), [current]);

  useEffect(() => {
    fetchSubscribers(myAccountId)
      .then(list => setSubscribers(list.filter(s => !currentIds.has(s.account.id))))
      .catch(() => setErr('Не удалось загрузить подписчиков'))
      .finally(() => setLoading(false));

    setTimeout(() => searchRef.current?.focus(), 100);

    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [myAccountId, onClose]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter(s =>
      s.account.login.toLowerCase().includes(q) ||
      s.personInfo?.firstName?.toLowerCase().includes(q) ||
      s.personInfo?.lastName?.toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelected(new Set(filtered.map(s => s.account.id)));
  const clearAll  = () => setSelected(new Set());

  const handleConfirm = () => {
    const picked = subscribers
      .filter(s => selected.has(s.account.id))
      .map(s => ({
        accountId:    s.account.id,
        login:        s.account.login,
        firstName:    s.personInfo?.firstName ?? null,
        lastName:     s.personInfo?.lastName  ?? null,
        avatarFileId: null,
      }));
    onAdd(picked);
    onClose();
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Белый список">

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Белый список</h3>
            {subscribers.length > 0 && (
              <span className={styles.count}>{subscribers.length} подписчиков</span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
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
            onFocus={e => e.currentTarget.select()}
          />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        {filtered.length > 0 && !loading && (
          <div className={styles.selectAllRow}>
            <span className={styles.selectedCount}>
              {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Никто не выбран'}
            </span>
            <button className={styles.selectAllBtn} onClick={selected.size === filtered.length ? clearAll : selectAll}>
              {selected.size === filtered.length ? 'Снять все' : 'Выбрать всех'}
            </button>
          </div>
        )}

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err ? (
            <div className={styles.emptyErr}>{err}</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>{search ? 'Никого не найдено' : 'Нет подписчиков'}</div>
          ) : filtered.map(s => (
            <div
              key={s.account.id}
              className={`${styles.item} ${selected.has(s.account.id) ? styles.itemSelected : ''}`}
              onClick={() => toggle(s.account.id)}
            >
              <div className={styles.checkbox}>
                {selected.has(s.account.id) && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div className={styles.ava}>
                <UserAvatar accountId={s.account.id} initials={getInitials(s)} size={34} />
              </div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {s.personInfo?.firstName
                    ? `${s.personInfo.firstName} ${s.personInfo.lastName ?? ''}`.trim()
                    : s.account.login}
                </div>
                <div className={styles.login}>@{s.account.login}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={selected.size === 0}>
            {`Добавить${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>

      </div>
    </>
  );
}
