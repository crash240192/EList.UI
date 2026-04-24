// features/event/ParticipantsModal.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IParticipantView } from '@/entities/event';
import { fetchEventParticipantsPage } from '@/entities/event/participationApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import styles from './ParticipantsModal.module.css';

interface ParticipantsModalProps {
  eventId: string;
  organizerIds?: Set<string>;
  currentAccountId: string | null;
  onClose: () => void;
  /** Для обратной совместимости — начальный список уже загруженных */
  participants?: IParticipantView[];
}

type FilterType = 'all' | 'following' | 'followers';

function getInitials(p: IParticipantView): string {
  if (p.firstName) return `${p.firstName[0]}${p.lastName?.[0] ?? ''}`.toUpperCase();
  return p.login?.[0]?.toUpperCase() ?? '?';
}

const AVA_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
function avaColor(id: string): string {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVA_COLORS[h % AVA_COLORS.length];
}

const PAGE_SIZE = 20;

export function ParticipantsModal({
  eventId, organizerIds = new Set(), currentAccountId, onClose,
}: ParticipantsModalProps) {
  const navigate = useNavigate();
  const [items,    setItems]    = useState<IParticipantView[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [loadMore, setLoadMore] = useState(false);
  const [page,     setPage]     = useState(0);
  const [hasMore,  setHasMore]  = useState(true);
  const [filter,   setFilter]   = useState<FilterType>('all');
  const [search,   setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    setTimeout(() => searchRef.current?.focus(), 50);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  // Debounce поиска
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
  }, [search]);

  // При смене фильтра или поиска — сброс и загрузка с начала
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    loadPage(0, filter, debouncedSearch, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch, eventId]);

  const loadPage = useCallback(async (
    p: number, f: FilterType, q: string, initial = false
  ) => {
    if (initial) setLoading(true); else setLoadMore(true);
    try {
      const req = {
        eventId,
        subscriberId:   f === 'following' && currentAccountId ? currentAccountId : null,
        subscribedToId: f === 'followers' && currentAccountId ? currentAccountId : null,
        name: q.trim() || null,
        pageIndex: p,
        pageSize: PAGE_SIZE,
      };
      const res = await fetchEventParticipantsPage(req);
      setTotal(res.total);
      setItems(prev => initial ? res.items : [...prev, ...res.items]);
      setHasMore(res.items.length === PAGE_SIZE);
      setPage(p + 1);
    } catch { /* ignore */ }
    finally { if (initial) setLoading(false); else setLoadMore(false); }
  }, [eventId, currentAccountId]);

  // Инфинит-скролл
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!hasMore || loadMore || loading) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
        loadPage(page, filter, debouncedSearch);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loadMore, loading, page, filter, debouncedSearch, loadPage]);

  const handleItemClick = (p: IParticipantView) => {
    onClose();
    navigate(p.accountId === currentAccountId ? '/user/me' : `/user/${p.accountId}`);
  };

  const tabLabel = (f: FilterType) => ({
    all: 'Все', following: 'Я подписан', followers: 'Мои подписчики',
  }[f]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Участники">

        {/* Хедер */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Участники</h3>
            {total > 0 && <span className={styles.count}>{total} человек</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Поиск */}
        <div className={styles.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input ref={searchRef} className={styles.searchInput}
            placeholder="Поиск по имени или логину..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        {/* Табы */}
        {currentAccountId && (
          <div className={styles.tabs}>
            {(['all','following','followers'] as FilterType[]).map(f => (
              <button key={f}
                className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
                onClick={() => setFilter(f)}>
                {tabLabel(f)}
              </button>
            ))}
          </div>
        )}

        {/* Список */}
        <div className={styles.list} ref={listRef}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'Никого не найдено' : filter !== 'all' ? 'Нет участников в этой категории' : 'Нет участников'}
            </div>
          ) : (
            <>
              {items.map(p => {
                const isMe  = p.accountId === currentAccountId;
                const isOrg = organizerIds.has(p.accountId);
                const name  = p.firstName ? `${p.firstName} ${p.lastName ?? ''}`.trim() : p.login;
                return (
                  <div key={p.accountId} className={styles.item} onClick={() => handleItemClick(p)}>
                    <div className={styles.avaWrap} style={{ background: avaColor(p.accountId) }}>
                      <UserAvatar accountId={p.accountId} initials={getInitials(p)} size={34} />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{name}</div>
                      <div className={styles.login}>@{p.login}</div>
                    </div>
                    <div className={styles.badges}>
                      {isOrg && <span className={`${styles.badge} ${styles.badgeOrg}`}>организатор</span>}
                      {isMe  && <span className={`${styles.badge} ${styles.badgeMe}`}>это вы</span>}
                    </div>
                  </div>
                );
              })}
              {loadMore && <div className={styles.footer}>Загрузка...</div>}
              {!hasMore && items.length > 0 && (
                <div className={styles.footer}>Показано все {items.length}</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
