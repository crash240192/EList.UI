// pages/invitations/InvitationsPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserInvitations, type IInvitation } from '@/entities/invitation/invitationsApi';
import { apiClient } from '@/shared/api/client';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { EventModal } from '@/pages/home/EventModal';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import styles from './InvitationsPage.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
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
  const [previewInv,  setPreviewInv]  = useState<IInvitation | null>(null);
  const [confirmDecl, setConfirmDecl] = useState<IInvitation | null>(null);

  useEffect(() => {
    fetchUserInvitations()
      .then(r => setItems(r.result))
      .catch(() => setErr('Не удалось загрузить приглашения'))
      .finally(() => setLoading(false));
  }, []);

  const doAccept = async (inv: IInvitation) => {
    try {
      await apiClient.get(`/api/invitations/accept?invitationId=${inv.id}`);
      setItems(prev => prev.filter(i => i.id !== inv.id));
      setPreviewInv(null);
      navigate(`/event/${inv.eventId}`);
    } catch { /* ignore */ }
  };

  const doDecline = async (inv: IInvitation) => {
    try {
      await apiClient.get(`/api/invitations/decline?invitationId=${inv.id}`);
      setItems(prev => prev.filter(i => i.id !== inv.id));
      setConfirmDecl(null);
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* Заголовок карточки */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>Приглашения</h1>
            {!loading && items.length > 0 && (
              <span className={styles.badge}>{items.length}</span>
            )}
          </div>

          {/* Загрузка */}
          {loading && (
            <div className={styles.skeletons}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          )}

          {/* Ошибка */}
          {err && <div className={styles.err}>{err}</div>}

          {/* Пусто */}
          {!loading && !err && items.length === 0 && (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 13a19.8 19.8 0 01-3.07-8.67A2 2 0 012 2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <p>Приглашений пока нет</p>
            </div>
          )}

          {/* Список */}
          {!loading && items.map(inv => {
            const event = inv.event;
            const types = (event as any).eventTypes?.length > 0
              ? (event as any).eventTypes
              : (event as any).eventType ? [(event as any).eventType] : [];
            const params = (event as any).parameters;
            const cost   = params?.cost ?? 0;
            const age    = params?.ageLimit;

            return (
              <div key={inv.id} className={styles.item}>
                {/* Левая часть: обложка + текст */}
                <div className={styles.itemLeft} onClick={() => navigate(`/event/${inv.eventId}`)}>
                  <div className={styles.cover}>
                    {event.coverImageId
                      ? <AuthImage fileId={event.coverImageId} alt={event.name} className={styles.coverImg} />
                      : <div className={styles.coverPlaceholder} />}
                  </div>
                  <div className={styles.content}>
                    <div className={styles.who}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span className={styles.whoName}>{inviterName(inv)}</span>
                      <span>приглашает</span>
                    </div>
                    <div className={styles.eName}>{event.name}</div>
                    <div className={styles.meta}>
                      <div className={styles.mi}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {formatDate(event.startTime)}
                      </div>
                      {event.address && (
                        <div className={styles.mi}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {event.address}
                        </div>
                      )}
                      <div className={`${styles.mi} ${cost === 0 ? styles.miFree : styles.miPaid}`}>
                        {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
                      </div>
                      {age && age > 0 && <div className={styles.mi}>{age}+</div>}
                    </div>
                    {types.length > 0 && (
                      <div className={styles.chips}>
                        {types.filter(Boolean).slice(0, 3).map((t: any) => {
                          const color = t.eventCategory?.color ?? '#6366f1';
                          return (
                            <span key={t.id} className={styles.chip} style={{ background: `${color}20`, border: `0.5px solid ${color}55`, color }}>
                              {t.ico && <img src={icoToUrl(t.ico) ?? undefined} alt="" width={10} height={10} style={{ objectFit: 'contain', borderRadius: 2 }} />}
                              {t.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Правая часть: кнопки вертикально */}
                <div className={styles.itemActions}>
                  <button className={`${styles.btn} ${styles.btnOk}`}
                    onClick={e => { e.stopPropagation(); setPreviewInv(inv); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Принять
                  </button>
                  <button className={`${styles.btn} ${styles.btnNo}`}
                    onClick={e => { e.stopPropagation(); setConfirmDecl(inv); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Отклонить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Предпросмотр мероприятия при нажатии «Принять» */}
      {previewInv && (
        <EventModal
          event={previewInv.event as any}
          onClose={() => setPreviewInv(null)}
        >
          <div className={styles.previewActions}>
            <button className={styles.laterBtn} onClick={() => setPreviewInv(null)}>
              Решу позже
            </button>
            <button className={styles.acceptConfirmBtn} onClick={() => doAccept(previewInv)}>
              ✓ Принять приглашение
            </button>
          </div>
        </EventModal>
      )}

      {/* Диалог подтверждения отклонения */}
      {confirmDecl && (
        <>
          <div className={styles.dialogBackdrop} onClick={() => setConfirmDecl(null)} />
          <div className={styles.dialog}>
            <div className={styles.dialogTitle}>Отклонить приглашение?</div>
            <div className={styles.dialogText}>
              Вы уверены, что хотите отклонить приглашение на «{confirmDecl.event.name}»?
            </div>
            <div className={styles.dialogBtns}>
              <button className={styles.dialogCancel} onClick={() => setConfirmDecl(null)}>Отмена</button>
              <button className={styles.dialogDecline} onClick={() => doDecline(confirmDecl)}>Отклонить</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
