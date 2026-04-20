// features/event/ParticipantsModal.tsx

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IParticipantView } from '@/entities/event';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { fetchSubscriptions, fetchSubscribers } from '@/entities/user/subscriptionApi';
import styles from './ParticipantsModal.module.css';

interface ParticipantsModalProps {
  participants:    IParticipantView[];
  organizerIds?:   Set<string>;
  currentAccountId: string | null;
  onClose:         () => void;
}

type FilterType = 'all' | 'following' | 'followers';

function getInitials(p: IParticipantView): string {
  if (p.firstName) return `${p.firstName[0]}${p.lastName?.[0] ?? ''}`.toUpperCase();
  return p.login?.[0]?.toUpperCase() ?? '?';
}

const AVA_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
function avaColor(accountId: string): string {
  let h = 0; for (const c of accountId) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVA_COLORS[h % AVA_COLORS.length];
}

export function ParticipantsModal({ participants, organizerIds = new Set(), currentAccountId, onClose }: ParticipantsModalProps) {
  const navigate = useNavigate();
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<FilterType>('all');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds,  setFollowerIds]  = useState<Set<string>>(new Set());
  const [loadingRel,   setLoadingRel]   = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    setTimeout(() => searchRef.current?.focus(), 50);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    if (!currentAccountId) { setLoadingRel(false); return; }
    Promise.all([
      fetchSubscriptions(currentAccountId).catch(() => []),
      fetchSubscribers(currentAccountId).catch(() => []),
    ]).then(([subs, follows]) => {
      setFollowingIds(new Set(subs.map((s: any) => s.accountId ?? s.id)));
      setFollowerIds( new Set(follows.map((s: any) => s.accountId ?? s.id)));
    }).finally(() => setLoadingRel(false));
  }, [currentAccountId]);

  const filtered = useMemo(() => {
    let list = participants;
    if (filter === 'following') list = list.filter(p => followingIds.has(p.accountId));
    if (filter === 'followers') list = list.filter(p => followerIds.has(p.accountId));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.login?.toLowerCase().includes(q) ||
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [participants, filter, search, followingIds, followerIds]);

  const handleItemClick = useCallback((p: IParticipantView) => {
    onClose();
    navigate(p.accountId === currentAccountId ? '/user/me' : `/user/${p.accountId}`);
  }, [navigate, onClose, currentAccountId]);

  const tabLabel = (f: FilterType) => ({
    all:       'Все',
    following: 'Я подписан',
    followers: 'Мои подписчики',
  }[f]);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label="Участники">

        {/* Хедер */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Участники</h3>
            <span className={styles.count}>{participants.length} человек</span>
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
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        {/* Табы */}
        {!loadingRel && currentAccountId && (
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
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'Никого не найдено' : filter !== 'all' ? 'Нет участников в этой категории' : 'Нет участников'}
            </div>
          ) : filtered.map(p => {
            const isMe  = p.accountId === currentAccountId;
            const isOrg = organizerIds.has(p.accountId);
            const name  = p.firstName ? `${p.firstName} ${p.lastName ?? ''}`.trim() : p.login;

            return (
              <div key={p.accountId} className={styles.item} onClick={() => handleItemClick(p)}>
                {/* Аватарка */}
                <div className={styles.avaWrap} style={{ background: avaColor(p.accountId) }}>
                  <UserAvatar accountId={p.accountId} initials={getInitials(p)} size={34} />
                </div>

                {/* Имя + логин */}
                <div className={styles.info}>
                  <div className={styles.name}>{name}</div>
                  <div className={styles.login}>@{p.login}</div>
                </div>

                {/* Бейджи */}
                <div className={styles.badges}>
                  {isOrg && <span className={`${styles.badge} ${styles.badgeOrg}`}>организатор</span>}
                  {isMe  && <span className={`${styles.badge} ${styles.badgeMe}`}>это вы</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Футер */}
        {filtered.length > 0 && (
          <div className={styles.footer}>
            Показано {filtered.length}{filter === 'all' && filtered.length < participants.length ? ` из ${participants.length}` : ''}
          </div>
        )}
      </div>
    </>
  );
}
