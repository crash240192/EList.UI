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
import { YandexMap } from '@/features/event-map/YandexMap';
import { icoToUrl } from '@/shared/lib/icoToUrl';
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
      await apiClient.put(`/api/events/update/${id}`, { active: false });
      setEvent(ev => ev ? { ...ev, active: false } : ev);
      setCancelConfirm(false);
    } finally { setActionLoading(false); }
  }, [id]);

  if (loading) return <PageSkeleton />;
  if (!event) return (
    <div className={styles.errorState}>
      <span className={styles.errorIcon}>😕</span>
      <p>Мероприятие не найдено</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
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

        {/* Top controls */}
        <div className={styles.heroTop}>
          <button className={styles.heroBtn} onClick={() => navigate(-1)} aria-label="Назад">
            <ChevronLeft />
          </button>
          <div className={styles.heroTopRight}>
            <button
              className={`${styles.heroBtn} ${isFavorite(event.id) ? styles.heroBtnFav : ''}`}
              onClick={() => toggleFav(event.id)} aria-label="В избранное"
            >
              <HeartIcon filled={isFavorite(event.id)} />
            </button>
            <button className={styles.heroBtn} aria-label="Поделиться"><ShareIcon /></button>
          </div>
        </div>

        {/* Bottom tags */}
        <div className={styles.heroBottom}>
          {/* Категории и типы */}
          {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes! : event.eventType ? [event.eventType] : []).map(t => {
            const catColor = t.eventCategory?.color ?? '#6366f1';
                const textColor = contrastColor(catColor);
            return (
              <span key={t.id} className={styles.tagType} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: `${catColor}55`,
                border: `1px solid ${catColor}44`,
                color: textColor,
              }}>
                {t.ico && (
                  <img src={icoToUrl(t.ico) ?? ''} className="event-type-ico"
                    alt="" width={12} height={12} style={{ objectFit: 'contain', borderRadius: 2 }} />
                )}
                {t.name}
              </span>
            );
          })}
          {/* Категория первого типа */}
          {(event.eventTypes?.[0] ?? event.eventType)?.eventCategory?.name && (
            <span className={styles.tagCat}>
              {(event.eventTypes?.[0] ?? event.eventType)!.eventCategory!.name}
            </span>
          )}
          {cost === 0 && <span className={styles.tagFree}>Бесплатно</span>}
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>

        {/* Title + rating */}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{event.name}</h1>
          {event.anticipationRating != null && (
            <div className={styles.ratingBadge}>
              <StarIcon />
              {event.anticipationRating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Meta pills — без участников, они уже есть в action bar */}
        <div className={styles.metaStrip}>
          <div className={`${styles.metaPill} ${styles.metaPillAccent}`}>
            <CalendarIcon />
            {formatDateFull(event.startTime, event.endTime)}
          </div>
          {event.address && (
            <div className={styles.metaPill}>
              <PinIcon />
              {event.address}
            </div>
          )}
          {event.parameters?.ageLimit && (
            <div className={`${styles.metaPill} ${styles.metaPillAge}`}>
              {event.parameters.ageLimit}+
            </div>
          )}
        </div>

        {/* ── Action bar ── */}
        <div className={styles.actionBar}>
          {/* Аватары участников — social proof рядом с кнопкой */}
          {sortedParticipants.length > 0 && (
            <div
              className={styles.participantPreview}
              onClick={() => setParticipantsModalOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Посмотреть всех участников"
            >
              <div className={styles.avatarStack}>
                {visibleParticipants.map((p, i) => (
                  <div key={p.accountId}
                    className={`${styles.avatarSm} ${p.accountId === accountId ? styles.avatarSmMe : ''}`}
                    style={{ zIndex: 3 - i }}
                  >
                    {(p.firstName?.[0] ?? p.login?.[0] ?? '?').toUpperCase()}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className={`${styles.avatarSm} ${styles.avatarSmExtra}`}>+{extraCount}</div>
                )}
              </div>
              <span className={styles.participantText}>
                <strong>{participants.length}</strong> участников
              </span>
            </div>
          )}

          <div className={styles.actionBtns}>
            <button className={styles.btnShare} aria-label="Поделиться"><ShareIcon /></button>
            {/* Кнопка «Пригласить» — для организаторов или если разрешено участникам */}
            {accountId && event?.id && (isOrganizer || (isParticipating && event.parameters?.allowUsersToInvite)) && (
              <button
                className={styles.btnShare}
                title="Пригласить подписчиков"
                onClick={() => setInviteModalOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M3 21v-1a6 6 0 0 1 9.29-5"/>
                  <circle cx="19" cy="17" r="4"/>
                  <line x1="19" y1="14" x2="19" y2="20"/>
                  <line x1="16" y1="17" x2="22" y2="17"/>
                </svg>
              </button>
            )}
            {isOrganizer ? (
              <button className={styles.btnJoin} onClick={() => navigate(`/edit-event/${event.id}`)}>
                ✏️ Редактировать
              </button>
            ) : (
              <button
                className={`${styles.btnJoin} ${isParticipating ? styles.btnLeave : ''}`}
                onClick={handleParticipate}
                disabled={actionLoading || !accountId}
              >
                {actionLoading ? '...' : isParticipating ? 'Покинуть' : 'Участвовать'}
              </button>
            )}
          </div>
        </div>

        {/* ── Two column ── */}
        <div className={styles.twoCol}>

          {/* Left: description + participants */}
          <div className={styles.leftCol}>

            <div className={styles.sectionLabel}>О мероприятии</div>
            <p className={`${styles.description} ${descExpanded ? styles.descriptionFull : ''}`}>
              {event.description ?? 'Описание отсутствует'}
            </p>
            {(event.description?.length ?? 0) > 200 && (
              <button className={styles.readMore} onClick={() => setDescExpanded(v => !v)}>
                {descExpanded ? 'Свернуть' : 'Показать полностью'}
              </button>
            )}

            {/* Participants */}
            {sortedParticipants.length > 0 && (
              <div className={styles.participantsBlock}>
                <div className={styles.sectionLabel}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setParticipantsModalOpen(true)}
                >
                  Участники ({sortedParticipants.length})
                </div>
                <div className={styles.chipsList} onClick={() => setParticipantsModalOpen(true)} style={{ cursor: 'pointer' }}>
                  {sortedParticipants.slice(0, 12).map(p => (
                    <UserChip key={p.accountId} user={{
                      accountId: p.accountId, login: p.login,
                      firstName: p.firstName, lastName: p.lastName,
                      isMe: p.accountId === accountId,
                    }} size="sm" />
                  ))}
                  {sortedParticipants.length > 12 && (
                    <span className={styles.moreChip}>ещё {sortedParticipants.length - 12} →</span>
                  )}
                </div>
              </div>
            )}

            {/* Organizer management (only for organizers) */}
            {isOrganizer && (
              <div className={styles.managementBlock}>
                <div className={styles.sectionLabel}>Управление</div>
                <div className={styles.managementBtns}>
                  <button className={styles.mgmtBtn}>👥 Добавить организатора</button>
                  {event.parameters?.private && (
                    <button className={styles.mgmtBtn}>✅ Белый список</button>
                  )}
                  {event.active && (
                    <button
                      className={`${styles.mgmtBtn} ${styles.mgmtBtnDanger}`}
                      onClick={() => setCancelConfirm(true)}
                    >
                      ❌ Отменить мероприятие
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: info card + map + organizers */}
          <div className={styles.rightCol}>

            {/* Info card */}
            <div className={styles.infoCard}>

              {/* Дата — рендерим напрямую, не через InfoRow */}
              <div className={`${styles.infoRow} ${styles.infoRow}`}>
                <div className={styles.infoIcon}><CalendarIcon /></div>
                <div className={styles.infoText}>
                  {isSameDay(event.startTime, event.endTime) ? (
                    <div className={styles.infoValue}>
                      <strong>{formatDateStart(event.startTime)}</strong>
                      <span>
                        {formatTime(event.startTime)}
                        {event.endTime ? ` — ${formatTime(event.endTime)}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className={styles.infoValue}>
                      <span className={styles.dateSubLabel}>Начало</span>
                      <strong>{formatDateStart(event.startTime)}, {formatTime(event.startTime)}</strong>
                      <span className={`${styles.dateSubLabel} ${styles.dateSubLabelGap}`}>Окончание</span>
                      <strong>{formatDateStart(event.endTime!)}, {formatTime(event.endTime!)}</strong>
                    </div>
                  )}
                </div>
              </div>
              {event.address && (
                <InfoRow icon={<PinIcon />} label="Адрес">
                  <strong className={styles.accentText}>{event.address}</strong>
                </InfoRow>
              )}
              <InfoRow icon={<MoneyIcon />} label="Стоимость">
                <strong className={cost === 0 ? styles.freeText : ''}>
                  {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
                </strong>
              </InfoRow>
              {maxPersons && (
                <InfoRow icon={<PeopleIcon />} label="Вместимость">
                  <strong>{participants.length} / {maxPersons}</strong>
                  <div className={styles.fillBar}>
                    <div className={styles.fillBarFill} style={{ width: `${fillPct}%` }} />
                  </div>
                </InfoRow>
              )}
            </div>

            {/* Map */}
            {event.latitude != null && event.longitude != null && (
              <div className={styles.mapCard}>
                <YandexMap lat={event.latitude} lng={event.longitude} label={event.name} zoom={14} draggable={false} />
              </div>
            )}

            {/* Organizers */}
            {organizers.length > 0 && (
              <div className={styles.infoCard}>
                <div className={styles.sectionLabel} style={{ marginBottom: 10 }}>Организаторы</div>
                <div className={styles.chipsList}>
                  {organizers.map(o => (
                    <UserChip key={o.accountId} user={{
                      accountId: o.accountId,
                      login:     o.login,
                      firstName: o.firstName,
                      lastName:  o.lastName,
                      isMe:      o.accountId === accountId,
                    }} size="sm" />
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>{/* end twoCol */}
      </div>{/* end content */}
      </div>{/* end card */}

      {/* Фотоальбомы */}
      <div style={{ padding: '0 16px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <EventAlbums eventId={id!} />
      </div>

      {/* Диалог подтверждения отмены мероприятия */}
      {cancelConfirm && (
        <CancelConfirmDialog
          eventName={event.name}
          loading={actionLoading}
          onConfirm={handleCancelEvent}
          onClose={() => setCancelConfirm(false)}
        />
      )}

      {participantsModalOpen && (
        <ParticipantsModal
          eventId={id!}
          organizerIds={new Set(organizers.map(o => o.accountId))}
          currentAccountId={accountId}
          onClose={() => setParticipantsModalOpen(false)}
        />
      )}

      {inviteModalOpen && accountId && event?.id && (
        <InviteModal
          eventId={event.id}
          currentAccountId={accountId}
          onClose={() => setInviteModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Info row helper ──

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
          <button
            style={{ flex:1,background:'var(--danger)',color:'#fff',border:'none',borderRadius:10,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',opacity: loading ? 0.6 : 1 }}
            onClick={onConfirm} disabled={loading}
          >
            {loading ? 'Отмена...' : 'Да, отменить'}
          </button>
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className={styles.infoRow}>
      <div className={styles.infoIcon}>{icon}</div>
      <div className={styles.infoText}>
        <div className={styles.infoLabel}>{label}</div>
        <div className={styles.infoValue}>{children}</div>
      </div>
    </div>
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
