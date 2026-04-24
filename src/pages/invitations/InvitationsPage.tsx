// pages/invitations/InvitationsPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserInvitations, type IInvitation } from '@/entities/invitation/invitationsApi';
import { apiClient } from '@/shared/api/client';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './InvitationsPage.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function inviterName(inv: IInvitation): string {
  const p = inv.inviter?.personInfo;
  if (p?.firstName) return `${p.firstName} ${p.lastName ?? ''}`.trim();
  return inv.inviter?.account?.login ?? 'Неизвестный';
}

export default function InvitationsPage() {
  const navigate = useNavigate();
  const [items,   setItems]   = useState<IInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    fetchUserInvitations()
      .then(r => setItems(r.result))
      .catch(() => setErr('Не удалось загрузить приглашения'))
      .finally(() => setLoading(false));
  }, []);

  const handleAccept = async (invId: string, eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.get(`/api/invitations/accept?invitationId=${invId}`);
      navigate(`/event/${eventId}`);
    } catch { /* ignore */ }
  };

  const handleDecline = async (invId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.get(`/api/invitations/decline?invitationId=${invId}`);
      setItems(prev => prev.filter(i => i.id !== invId));
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Приглашения</h1>
        {!loading && items.length > 0 && (
          <span className={styles.count}>{items.length}</span>
        )}
      </div>

      {loading && (
        <div className={styles.loadingList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}

      {err && <div className={styles.err}>{err}</div>}

      {!loading && !err && items.length === 0 && (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35 }}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 13a19.8 19.8 0 01-3.07-8.67A2 2 0 012 2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          <p>Приглашений пока нет</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.list}>
          {items.map(inv => (
            <div key={inv.id} className={styles.card} onClick={() => navigate(`/event/${inv.eventId}`)}>
              <div className={styles.cover}>
                {inv.event.coverImageId
                  ? <AuthImage fileId={inv.event.coverImageId} alt={inv.event.name} className={styles.coverImg} />
                  : <div className={styles.coverPlaceholder}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                }
              </div>

              <div className={styles.content}>
                <div className={styles.inviterRow}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span className={styles.inviterName}>{inviterName(inv)}</span>
                  <span className={styles.inviterSuffix}>приглашает</span>
                </div>
                <div className={styles.eventName}>{inv.event.name}</div>
                <div className={styles.eventMeta}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {formatDate(inv.event.startTime)}
                  {inv.event.address && (
                    <>
                      <span className={styles.metaDot}>·</span>
                      <span className={styles.address}>{inv.event.address}</span>
                    </>
                  )}
                </div>

                {/* Кнопки принять/отклонить */}
                <div className={styles.actions}>
                  <button className={styles.acceptBtn} onClick={e => handleAccept(inv.id, inv.eventId, e)}>
                    Принять
                  </button>
                  <button className={styles.declineBtn} onClick={e => handleDecline(inv.id, e)}>
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
