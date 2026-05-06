// features/event/InviteModal.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSubscribers } from '@/entities/user/subscriptionApi';
import type { ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { createInvitations } from '@/entities/invitation/invitationsApi';
import { useDebounce, useInfiniteScroll } from '@/shared/hooks';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import styles from './InviteModal.module.css';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';

const PAGE_SIZE = 20;

interface InviteModalProps {
  eventId: string;
  currentAccountId: string;
  onClose: () => void;
  onSent?: (count: number) => void;
}

function getInitials(p: ISubscriptionItem): string {
  const pi = p.personInfo;
  if (pi?.firstName) return `${pi.firstName[0]}${pi.lastName?.[0] ?? ''}`.toUpperCase();
  return p.account.login[0].toUpperCase();
}

export function InviteModal({ eventId, currentAccountId, onClose, onSent }: InviteModalProps) {
  useModalBackButton(onClose);

  const [search,      setSearch]      = useState('');
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [err,         setErr]         = useState<string | null>(null);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 350);

  // Загрузка / перезагрузка при смене поиска
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPage(1);
    fetchSubscribers(currentAccountId, { name: debouncedSearch || undefined, pageIndex: 1, pageSize: PAGE_SIZE })
      .then(data => {
        if (cancelled) return;
        setSubscribers(data.items);
        setTotal(data.total);
      })
      .catch(() => { if (!cancelled) setErr('Не удалось загрузить подписчиков'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
    } finally { setLoadingMore(false); }
  }, [loadingMore, subscribers.length, total, page, debouncedSearch, currentAccountId]);

  const sentinelRef = useInfiniteScroll(loadMore);

  useEffect(() => {
    setTimeout(() => searchRef.current?.select?.(), 200);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelected(prev => new Set([...prev, ...subscribers.map(s => s.account.id)]));
  const clearAll  = () => setSelected(new Set());
  const allSelected = subscribers.length > 0 && subscribers.every(s => selected.has(s.account.id));

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true); setErr(null);
    try {
      await createInvitations({ accountIds: [...selected], eventId });
      setSent(true);
      onSent?.(selected.size);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally { setSending(false); }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Пригласить">

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Пригласить</h3>
            {!loading && <span className={styles.count}>{total} подписчиков</span>}
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
          <input ref={searchRef} className={styles.searchInput} onFocus={e => e.currentTarget.select()}
            placeholder="Поиск по имени или логину..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        {!loading && subscribers.length > 0 && (
          <div className={styles.selectAllRow}>
            <span className={styles.selectedCount}>
              {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Никто не выбран'}
            </span>
            <button className={styles.selectAllBtn} onClick={allSelected ? clearAll : selectAll}>
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
            <div className={styles.empty}>{search ? 'Никого не найдено' : 'Нет подписчиков'}</div>
          ) : (
            <>
              {subscribers.map(s => (
                <div key={s.account.id}
                  className={`${styles.item} ${selected.has(s.account.id) ? styles.itemSelected : ''}`}
                  onClick={() => toggleSelect(s.account.id)}>
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
                      {s.personInfo?.firstName ? `${s.personInfo.firstName} ${s.personInfo.lastName ?? ''}`.trim() : s.account.login}
                    </div>
                    <div className={styles.login}>@{s.account.login}</div>
                  </div>
                </div>
              ))}
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
          {sent ? (
            <div className={styles.sentMsg}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Приглашения отправлены!
            </div>
          ) : (
            <>
              <button className={styles.cancelBtn} onClick={onClose} disabled={sending}>Отмена</button>
              <button className={styles.sendBtn} onClick={handleSend}
                disabled={selected.size === 0 || sending}>
                {sending ? 'Отправка...' : `Пригласить${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
