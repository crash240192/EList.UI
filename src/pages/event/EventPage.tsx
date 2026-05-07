// pages/event/EventPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent, IParticipantView, IEventOrganizator } from '@/entities/event';
import {
  fetchEventById, participateEvent, leaveEvent,
  fetchEventParticipants, fetchEventParameters,
  fetchEventOrganizators, MOCK_EVENTS,
} from '@/entities/event';
import { useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { apiClient } from '@/shared/api/client';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { UserChip } from '@/entities/user/ui/UserChip';
import { ParticipantsModal } from '@/features/event/ParticipantsModal';
import { InviteModal } from '@/features/event/InviteModal';
import { AddOrganizerModal } from '@/features/event/AddOrganizerModal';
import { YandexMap } from '@/features/event-map/YandexMap';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import { RatingWidget } from '@/features/event/RatingWidget';
import { EventAlbums } from './EventAlbums';
import styles from './EventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/** Возвращает белый или тёмный текст под цвет фона */
function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1a2e' : '#ffffff';
}

export default function EventPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId } = useAccountId();

  const [event,         setEvent]         = useState<IEvent | null>(null);
  const [participants,  setParticipants]  = useState<IParticipantView[]>([]);
  const [organizers,    setOrganizers]    = useState<IEventOrganizator[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [inviteModalOpen,       setInviteModalOpen]       = useState(false);
  const [descExpanded,  setDescExpanded]  = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addOrgModalOpen, setAddOrgModalOpen] = useState(false);

  const isParticipating = !!accountId && participants.some(p => p.accountId === accountId);
  const isOrganizer     = !!accountId && organizers.some(o => o.accountId === accountId);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      USE_MOCK ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0]) : fetchEventById(id),
      USE_MOCK ? Promise.resolve([] as IParticipantView[]) : fetchEventParticipants(id),
      USE_MOCK ? Promise.resolve(null) : fetchEventParameters(id),
      USE_MOCK ? Promise.resolve([] as IEventOrganizator[]) : fetchEventOrganizators(id),
    ]).then(([ev, parts, params, orgs]) => {
      if (params) ev = { ...ev, parameters: { ...params } };
      setEvent(ev); setParticipants(parts); setOrganizers(orgs);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleParticipate = useCallback(async () => {
    if (!id || !accountId) return;
    setActionLoading(true);
    try {
      if (isParticipating) {
        await leaveEvent(id);
        setParticipants(prev => prev.filter(p => p.accountId !== accountId));
      } else {
        await participateEvent(id);
        // Загружаем профиль текущего пользователя для корректного отображения чипа
        try {
          const { fetchFullProfile } = await import('@/entities/user/profileApi');
          const profile = await fetchFullProfile(null);
          setParticipants(prev => [...prev, {
            accountId,
            login:     profile.account.login,
            firstName: profile.person?.firstName ?? null,
            lastName:  profile.person?.lastName  ?? null,
          }]);
        } catch {
          setParticipants(prev => [...prev, { accountId, login: accountId.slice(0, 8), firstName: null, lastName: null }]);
        }
      }
    } finally { setActionLoading(false); }
  }, [id, accountId, isParticipating]);

  const handleCancelEvent = useCallback(async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/api/events/${id}/cancel`);
      setEvent(ev => ev ? { ...ev, active: false } : ev);
      setCancelConfirm(false);
    } finally { setActionLoading(false); }
  }, [id]);

  if (loading) return <PageSkeleton />;
  if (!event) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.errorState}>
          <span>😕</span>
          <p>Мероприятие не найдено</p>
          <button onClick={() => navigate(-1)}>← Назад</button>
        </div>
      </div>
    </div>
  );

  const cost = event.parameters?.cost ?? 0;
  const maxPersons = event.parameters?.maxPersonsCount ?? null;
  const fillPct = maxPersons ? Math.round((participants.length / maxPersons) * 100) : null;

  // Участники: текущий пользователь — первым
  const sortedParticipants = [
    ...participants.filter(p => p.accountId === accountId),
    ...participants.filter(p => p.accountId !== accountId),
  ];
  const visibleParticipants = sortedParticipants.slice(0, 3);
  const extraCount = Math.max(0, sortedParticipants.length - 3);

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* ── Hero ── */}
        <div className={styles.hero} style={!(event.coverImageId || event.coverUrl) ? {
          background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)',
        } : undefined}>
          {event.coverImageId ? (
            <AuthImage fileId={event.coverImageId} alt={event.name} className={styles.heroImg}
              fallback={event.coverUrl ? <img src={event.coverUrl} alt={event.name} className={styles.heroImg} /> : undefined} />
          ) : event.coverUrl ? (
            <img src={event.coverUrl} alt={event.name} className={styles.heroImg} />
          ) : null}
          <div className={styles.heroOverlay} />

          <div className={styles.heroTop}>
            <button className={styles.heroBtn} onClick={() => navigate(-1)} aria-label="Назад"><ChevronLeft /></button>
            <div className={styles.heroTopRight}>
              <button className={`${styles.heroBtn} ${isFavorite(event.id) ? styles.heroBtnFav : ''}`}
                onClick={() => toggleFav(event.id)} aria-label="В избранное">
                <HeartIcon filled={isFavorite(event.id)} />
              </button>
              <button className={styles.heroBtn} aria-label="Поделиться"><ShareIcon /></button>
              {/* Мобильное меню управления — только для организатора */}
              {isOrganizer && (
                <div className={styles.mobileMenuWrap}>
                  <button className={styles.heroBtn} onClick={() => setMobileMenuOpen(v => !v)} aria-label="Меню">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                  {mobileMenuOpen && (
                    <>
                      <div className={styles.mobileMenuBackdrop} onClick={() => setMobileMenuOpen(false)} />
                      <div className={styles.mobileMenu}>
                        <button className={styles.mobileMenuItem} onClick={() => { navigate(`/edit-event/${event.id}`); setMobileMenuOpen(false); }}>✏️ Редактировать</button>
                        <button className={styles.mobileMenuItem} onClick={() => { setAddOrgModalOpen(true); setMobileMenuOpen(false); }}>👥 Добавить организатора</button>
                        {event.parameters?.private && <button className={styles.mobileMenuItem}>✅ Белый список</button>}
                        {event.active && (
                          <button className={`${styles.mobileMenuItem} ${styles.mobileMenuItemDanger}`}
                            onClick={() => { setCancelConfirm(true); setMobileMenuOpen(false); }}>
                            ❌ Отменить мероприятие
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.heroBottom}>
            {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes! : event.eventType ? [event.eventType] : []).map(t => {
              const catColor = t.eventCategory?.color ?? '#6366f1';
              return (
                <span key={t.id} className={styles.tagType} style={{
                  background: `${catColor}55`, border: `1px solid ${catColor}44`,
                  color: contrastColor(catColor),
                }}>
                  {t.ico && <img src={icoToUrl(t.ico) ?? ''} className="event-type-ico" alt="" width={10} height={10} style={{ objectFit: 'contain' }} />}
                  {t.name}
                </span>
              );
            })}
            {(event.eventTypes?.[0] ?? event.eventType)?.eventCategory?.name && (
              <span className={styles.tagCat}>{(event.eventTypes?.[0] ?? event.eventType)!.eventCategory!.name}</span>
            )}
            {cost === 0 && <span className={styles.tagFree}>Бесплатно</span>}
            {event.parameters?.ageLimit && (
              <span className={styles.tagAge}>{event.parameters.ageLimit}+</span>
            )}
            {event.parameters?.private && (
              <span className={styles.tagPrivate}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Закрытое
              </span>
            )}
          </div>
        </div>

        {/* ── Action row ── */}
        <div className={styles.actionRow}>
          <h1 className={styles.actionTitle}>{event.name}</h1>
          <RatingWidget eventId={id!} eventStartTime={event.startTime} accountId={accountId} />
          <div className={styles.actionBtns}>
            {accountId && event?.id && (isOrganizer || (isParticipating && event.parameters?.allowUsersToInvite)) && (
              <button className={styles.btnIcon} title="Пригласить" onClick={() => setInviteModalOpen(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <circle cx="9" cy="7" r="4"/><path d="M3 21v-1a6 6 0 0 1 9.29-5"/><circle cx="19" cy="17" r="4"/>
                  <line x1="19" y1="14" x2="19" y2="20"/><line x1="16" y1="17" x2="22" y2="17"/>
                </svg>
              </button>
            )}
            <button className={`${styles.btnJoin} ${isParticipating ? styles.btnLeave : ''}`}
              onClick={handleParticipate} disabled={actionLoading || !accountId || isOrganizer}>
              {actionLoading ? '...' : isParticipating ? 'Покинуть' : 'Участвовать'}
            </button>
          </div>
        </div>

        {/* ── Основная сетка ── */}
        <div className={styles.mainGrid}>

          {/* ── Левая панель ── */}
          <div className={styles.leftPanel}>

            {/* Дата */}
            <div className={styles.metaRow}>
              <div className={styles.metaIco}><CalendarIcon /></div>
              <div className={styles.metaContent}>
                <div className={styles.metaLbl}>Дата</div>
                {isSameDay(event.startTime, event.endTime) ? (
                  <>
                    <div className={styles.metaVal}>{formatDateStart(event.startTime)}</div>
                    <div className={styles.metaValSub}>{formatTime(event.startTime)}{event.endTime ? ` — ${formatTime(event.endTime)}` : ''}</div>
                  </>
                ) : (
                  <>
                    <div className={styles.metaVal}>{formatDateStart(event.startTime)}, {formatTime(event.startTime)}</div>
                    <div className={styles.metaValSub}>→ {formatDateStart(event.endTime!)}, {formatTime(event.endTime!)}</div>
                  </>
                )}
              </div>
            </div>

            {/* Адрес */}
            {event.address && (
              <div className={styles.metaRow}>
                <div className={styles.metaIco}><PinIcon /></div>
                <div className={styles.metaContent}>
                  <div className={styles.metaLbl}>Место</div>
                  <div className={styles.metaVal}>{event.address}</div>
                </div>
              </div>
            )}

            {/* Цена + заполненность (на мобиле — одна строка) */}
            <div className={`${styles.priceAndFill} ${!maxPersons ? styles.priceOnly : ''}`}>
            <div className={styles.priceBlock}>
              <div className={cost === 0 ? styles.priceVal : styles.priceValPaid}>
                {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
              </div>
              {cost === 0
                ? <span className={styles.priceBadge}>Free</span>
                : <span className={styles.priceBadgePaid}>Платное</span>}
            </div>

            {maxPersons ? (
              <div className={styles.priceBlock}>
                <div className={styles.priceValPaid}>{participants.length} / {maxPersons}</div>
                <div className={styles.fillTrack} style={{ flex: 1, maxWidth: 60, alignSelf: 'center' }}>
                  <div className={styles.fillInner} style={{ width: `${Math.min(fillPct ?? 0, 100)}%` }} />
                </div>
              </div>
            ) : null}
            </div>

            {sortedParticipants.length > 0 && (
              <div className={styles.partRow} onClick={() => setParticipantsModalOpen(true)}>
                <div className={styles.avStack}>
                  {visibleParticipants.map((p, i) => (
                    <div key={p.accountId} className={`${styles.av} ${p.accountId === accountId ? styles.avMe : styles.avOther}`} style={{ zIndex: 3 - i }}>
                      {(p.firstName?.[0] ?? p.login?.[0] ?? '?').toUpperCase()}
                    </div>
                  ))}
                  {extraCount > 0 && <div className={`${styles.av} ${styles.avExtra}`}>+{extraCount}</div>}
                </div>
                <span className={styles.partCnt}><strong>{participants.length}</strong> участников</span>
              </div>
            )}

            {/* Альбомы */}
            <EventAlbums eventId={id!} compact />

            {/* Организаторы */}
            {organizers.length > 0 && (
              <div className={styles.orgsSection}>
                <div className={styles.secLabel}>Организаторы</div>
                {organizers.map(o => (
                  <div key={o.accountId} className={styles.orgChip} onClick={() => navigate(`/user/${o.accountId}`)}>
                    <div className={styles.orgChipAvatar}>
                      {(o.firstName?.[0] ?? o.login?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.orgChipName}>
                        {o.firstName ? `${o.firstName} ${o.lastName ?? ''}`.trim() : o.login}
                      </div>
                      <div className={styles.orgChipRole}>Организатор</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* ── Правая панель ── */}
          <div className={styles.rightPanel}>

            {/* Описание */}
            <div>
              <div className={styles.secLabel}>О мероприятии</div>
              <p className={`${styles.desc} ${descExpanded ? '' : styles.descClamped}`}>
                {event.description ?? 'Описание отсутствует'}
              </p>
              {(event.description?.length ?? 0) > 200 && (
                <button className={styles.readMore} onClick={() => setDescExpanded(v => !v)}>
                  {descExpanded ? 'Свернуть ↑' : 'Показать полностью ↓'}
                </button>
              )}
            </div>

            {/* Карта */}
            {event.latitude != null && event.longitude != null && (
              <div>
                <div className={styles.secLabel}>Место проведения</div>
                <div className={styles.mapBlock}>
                  <YandexMap lat={event.latitude} lng={event.longitude} label={event.name} zoom={14} draggable={false} />
                </div>
              </div>
            )}

            {/* Участники */}
            {sortedParticipants.length > 0 && (
              <div>
                <div className={styles.secLabel} style={{ cursor: 'pointer' }} onClick={() => setParticipantsModalOpen(true)}>
                  Участники ({sortedParticipants.length})
                </div>
                <div className={styles.chipsList} onClick={() => setParticipantsModalOpen(true)} style={{ cursor: 'pointer' }}>
                  {sortedParticipants.slice(0, 12).map(p => (
                    <UserChip key={p.accountId} user={{ accountId: p.accountId, login: p.login, firstName: p.firstName, lastName: p.lastName, isMe: p.accountId === accountId }} size="sm" />
                  ))}
                  {sortedParticipants.length > 12 && (
                    <span className={styles.moreChip}>ещё {sortedParticipants.length - 12} →</span>
                  )}
                </div>
              </div>
            )}

            {/* Обсуждения — заглушка */}
            <div>
              <div className={styles.secLabel}>Обсуждение</div>
              <div className={styles.discussionStub}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: .4, display: 'block', margin: '0 auto 6px' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Обсуждения появятся в следующем обновлении
              </div>
            </div>

          </div>
        </div>{/* end mainGrid */}
      </div>{/* end card */}

      {cancelConfirm && (
        <CancelConfirmDialog eventName={event.name} loading={actionLoading}
          onConfirm={handleCancelEvent} onClose={() => setCancelConfirm(false)} />
      )}
      {participantsModalOpen && (
        <ParticipantsModal eventId={id!} organizerIds={new Set(organizers.map(o => o.accountId))}
          currentAccountId={accountId} onClose={() => setParticipantsModalOpen(false)} />
      )}
      {inviteModalOpen && accountId && event?.id && (
        <InviteModal eventId={event.id} currentAccountId={accountId} onClose={() => setInviteModalOpen(false)} />
      )}
      {addOrgModalOpen && accountId && id && (
        <AddOrganizerModal
          eventId={id}
          currentAccountId={accountId}
          existingOrganizerIds={new Set(organizers.map(o => o.accountId))}
          onClose={() => setAddOrgModalOpen(false)}
          onSuccess={() => fetchEventOrganizators(id).then(setOrganizers)}
        />
      )}
    </div>
  );
}

// ── Cancel dialog ──

function CancelConfirmDialog({ eventName, loading, onConfirm, onClose }: {
  eventName: string; loading: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <>
      <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)',zIndex:500 }} onClick={onClose} />
      <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(360px,90vw)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:'24px 20px',zIndex:501,textAlign:'center' }}>
        <div style={{ fontSize:36,marginBottom:8 }}>❌</div>
        <h3 style={{ fontSize:16,fontWeight:700,color:'var(--text-primary)',margin:'0 0 8px' }}>Отменить мероприятие?</h3>
        <p style={{ fontSize:13,color:'var(--text-secondary)',margin:'0 0 20px',lineHeight:1.5 }}>
          «{eventName}» будет помечено как неактуальное. Участники увидят что мероприятие отменено.
        </p>
        <div style={{ display:'flex',gap:10 }}>
          <button style={{ flex:1,background:'none',border:'1px solid var(--border)',borderRadius:10,padding:'10px',fontSize:13,fontWeight:500,color:'var(--text-secondary)',cursor:'pointer' }} onClick={onClose}>
            Нет, назад
          </button>
          <button style={{ flex:1,background:'var(--danger)',color:'#fff',border:'none',borderRadius:10,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:loading ? 0.6 : 1 }}
            onClick={onConfirm} disabled={loading}>
            {loading ? 'Отмена...' : 'Да, отменить'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Skeleton ──

function PageSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonHero} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className={styles.skeletonLine} style={{ width: '70%', height: 26 }} />
        <div className={styles.skeletonLine} style={{ width: '40%', height: 14 }} />
        <div className={styles.skeletonLine} style={{ height: 44 }} />
      </div>
    </div>
  );
}

// ── Date helpers ──

const RU_DATE = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const RU_TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const RU_SHORT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function formatDateStart(iso: string)   { return RU_DATE.format(new Date(iso)); }
function formatTime(iso: string)        { return RU_TIME.format(new Date(iso)); }
function isSameDay(start: string, end: string | null): boolean {
  if (!end) return true;
  const a = new Date(start), b = new Date(end);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function formatDateFull(start: string, end: string | null) {
  if (!end) return RU_SHORT.format(new Date(start));
  if (isSameDay(start, end)) {
    // Одна дата: «24 мая, 19:00 — 23:00»
    return `${RU_SHORT.format(new Date(start))} — ${RU_TIME.format(new Date(end))}`;
  }
  // Разные даты: «24 мая, 19:00 — 25 мая, 23:00»
  return `${RU_SHORT.format(new Date(start))} — ${RU_SHORT.format(new Date(end))}`;
}

// ── Icons ──

function ChevronLeft() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>; }
function HeartIcon({ filled }: { filled: boolean }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function ShareIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>; }
function StarIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function CalendarIcon(){ return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function PinIcon()     { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function PeopleIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function MoneyIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
