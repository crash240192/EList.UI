// features/event/BWListModal.tsx

import { useState, useEffect } from 'react';
import { getBWList, removeFromBWList } from '@/entities/event/participationApi';
import type { IBWListUser, BWListType } from '@/entities/event/participationApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './InviteModal.module.css';

interface Props {
  eventId: string;
  listType: BWListType;
  onClose: () => void;
}

function getInitials(u: IBWListUser): string {
  if (u.personInfo?.firstName) return `${u.personInfo.firstName[0]}${u.personInfo.lastName?.[0] ?? ''}`.toUpperCase();
  return u.account.login[0].toUpperCase();
}

function getDisplayName(u: IBWListUser): string {
  return u.personInfo?.firstName
    ? `${u.personInfo.firstName} ${u.personInfo.lastName ?? ''}`.trim()
    : u.account.login;
}

export function BWListModal({ eventId, listType, onClose }: Props) {
  useModalBackButton(onClose);

  const title = listType === 'blackList' ? 'Черный список' : 'Белый список';

  const [items,    setItems]    = useState<IBWListUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getBWList(listType, eventId)
      .then(data => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setErr('Не удалось загрузить список'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listType, eventId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const handleRemove = async (accountId: string) => {
    setRemoving(accountId);
    try {
      await removeFromBWList(listType, eventId, accountId);
      setItems(prev => prev.filter(u => u.accountId !== accountId));
    } catch {
      setErr('Не удалось удалить пользователя');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label={title}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>{title}</h3>
            {!loading && <span className={styles.count}>{items.length} чел.</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>Загрузка...</div>
          ) : err ? (
            <div className={styles.empty} style={{ color: 'var(--danger)' }}>{err}</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>Список пуст</div>
          ) : (
            items.map(u => (
              <div key={u.accountId} className={`${styles.item} ${styles.itemDisabled}`}
                style={{ cursor: 'default' }}>
                <div className={styles.ava}>
                  <UserAvatar accountId={u.accountId} initials={getInitials(u)} size={34} />
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{getDisplayName(u)}</div>
                  <div className={styles.login}>@{u.account.login}</div>
                </div>
                <button
                  className={styles.removeBtn}
                  disabled={removing === u.accountId}
                  onClick={() => handleRemove(u.accountId)}
                  title="Удалить из списка"
                >
                  {removing === u.accountId ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
                      <circle cx="12" cy="12" r="9"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          {err && !loading && <span className={styles.footerErr}>{err}</span>}
          <button className={styles.cancelBtn} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </>
  );
}
