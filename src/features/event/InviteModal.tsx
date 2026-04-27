// features/event/InviteModal.tsx
// Модальное окно выбора подписчиков для приглашения на событие

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchSubscribers } from '@/entities/user/subscriptionApi';
import type { ISubscriptionItem } from '@/entities/user/subscriptionApi';
import { createInvitations } from '@/entities/invitation/invitationsApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import styles from './InviteModal.module.css';

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
  const [subscribers, setSubscribers] = useState<ISubscriptionItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [err,         setErr]         = useState<string | null>(null);
  const [sent,        setSent]        = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSubscribers(currentAccountId)
      .then(setSubscribers)
      .catch(() => setErr('Не удалось загрузить подписчиков'))
      .finally(() => setLoading(false));
    setTimeout(() => searchRef.current?.select?.(), 200);

    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [currentAccountId, onClose]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter(s =>
      s.account.login.toLowerCase().includes(q) ||
      s.personInfo?.firstName?.toLowerCase().includes(q) ||
      s.personInfo?.lastName?.toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectAll = () => setSelected(new Set(filtered.map(s => s.account.id)));
  const clearAll  = () => setSelected(new Set());

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

        {/* Хедер */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Пригласить</h3>
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

        {/* Поиск */}
        <div className={styles.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input ref={searchRef} className={styles.searchInput} onFocus={e => e.currentTarget.select()}
            placeholder="Поиск по имени или логину..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
        </div>

        {/* Выбрать всё */}
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

        {/* Список */}
        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err ? (
            <div className={styles.empty} style={{ color: 'var(--danger)' }}>{err}</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>{search ? 'Никого не найдено' : 'Нет подписчиков'}</div>
          ) : filtered.map(s => (
            <div key={s.account.id} className={`${styles.item} ${selected.has(s.account.id) ? styles.itemSelected : ''}`}
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
        </div>

        {/* Футер */}
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
