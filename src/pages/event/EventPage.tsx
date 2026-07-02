// pages/event/EventPage.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent, IParticipantView } from '@/entities/event';
import {
  fetchEventById, participateEvent, leaveEvent,
  fetchEventParticipants, fetchEventParameters,
  MOCK_EVENTS,
} from '@/entities/event';
import { useEventOrganizers } from '@/features/event/useEventOrganizers';
import { useToastStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { apiClient } from '@/shared/api/client';
import { EventHeroCover } from '@/features/event/EventHeroCover';
import { useEventHeadAlbumPhotos } from '@/features/event/useEventHeadAlbumPhotos';
import { ParticipantsChipPreview } from '@/features/event/ParticipantsChipPreview';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { ParticipantsModal } from '@/features/event/ParticipantsModal';
import { InviteModal } from '@/features/event/InviteModal';
import { AddOrganizerModal } from '@/features/event/AddOrganizerModal';
import { BWListModal } from '@/features/event/BWListModal';
import { YandexMap } from '@/features/event-map/YandexMap';
import { EventMapModal } from '@/features/event-map/EventMapModal';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import { RatingWidget, isEventFinished } from '@/features/event/RatingWidget';
import { EventAlbums } from './EventAlbums';
import { EventDiscussionsPanel } from '@/features/event-discussion';
import { AccessDeniedGate } from '@/shared/ui/AccessDenied/AccessDeniedGate';
import { isAccessDeniedError, isEventAccessDeniedError } from '@/shared/api/apiErrorUtils';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import { buildEventShareUrl, canUseNativeShare, shareLink } from '@/shared/lib/shareLink';
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
  const { accountId } = useAccountId();

  const [event,         setEvent]         = useState<IEvent | null>(null);
  const [participants,  setParticipants]  = useState<IParticipantView[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [inviteModalOpen,       setInviteModalOpen]       = useState(false);
  const [descExpanded,  setDescExpanded]  = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addOrgModalOpen, setAddOrgModalOpen] = useState(false);
  const [bwListOpen,      setBwListOpen]      = useState(false);
  const [mapModalOpen,    setMapModalOpen]    = useState(false);
  const [joinShake,       setJoinShake]       = useState(false);
  const [limitNotice,     setLimitNotice]     = useState(false);
  const [pageAccessDenied, setPageAccessDenied] = useState(false);
  const [participantsDenied, setParticipantsDenied] = useState(false);
  const limitNoticeTimerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const {
    organizers,
    isOrganizer,
    organizerIds,
    denied: organizersDenied,
    refetch: refetchOrganizers,
  } = useEventOrganizers(id, accountId);

  const headAlbumFileIds = useEventHeadAlbumPhotos(id);

  const isParticipating = !!accountId && participants.some(p => p.accountId === accountId);

  useEffect(() => {
    const el = pageRef.current;
    if (!el || !event) return;

    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 360);
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [event?.id]);

  useEffect(() => {
    if (!loading) return;
    setShowScrollTop(false);
  }, [loading]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPageAccessDenied(false);
    setParticipantsDenied(false);
    setEvent(null);
    setParticipants([]);

    if (USE_MOCK) {
      const ev = MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0];
      setEvent(ev);
      setParticipants([]);
      setLoading(false);
      return;
    }

    void fetchEventById(id)
      .then(async (ev) => {
        let merged = ev;
        const [partsResult, paramsResult] = await Promise.all([
          fetchEventParticipants(id)
            .then(p => ({ ok: true as const, data: p }))
            .catch(e => ({ ok: false as const, error: e })),
          fetchEventParameters(id)
            .then(p => ({ ok: true as const, data: p }))
            .catch(e => ({ ok: false as const, error: e })),
        ]);

        if (partsResult.ok) setParticipants(partsResult.data);
        else if (isAccessDeniedError(partsResult.error)) setParticipantsDenied(true);

        if (paramsResult.ok && paramsResult.data) {
          merged = { ...merged, parameters: { ...paramsResult.data } };
        }

        setEvent(merged);
      })
      .catch((e: unknown) => {
        if (isEventAccessDeniedError(e)) {
          setPageAccessDenied(true);
        } else {
          setEvent(null);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => {
    if (limitNoticeTimerRef.current) window.clearTimeout(limitNoticeTimerRef.current);
  }, []);

  const triggerParticipantLimitFeedback = useCallback(() => {
    setJoinShake(true);
    setLimitNotice(true);
    window.setTimeout(() => setJoinShake(false), 500);
    if (limitNoticeTimerRef.current) window.clearTimeout(limitNoticeTimerRef.current);
    limitNoticeTimerRef.current = window.setTimeout(() => {
      setLimitNotice(false);
      limitNoticeTimerRef.current = null;
    }, 4000);
  }, []);

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

  const handleShare = useCallback(() => {
    if (!event?.id) return;

    const url = buildEventShareUrl(event.id);
    const shareText = [
      event.name,
      event.address,
      formatDateFull(event.startTime, event.endTime),
    ].filter(Boolean).join(' · ');

    void shareLink({ title: event.name, text: shareText, url })
      .then((result) => {
        const copiedMsg = canUseNativeShare()
          ? 'Ссылка скопирована в буфер обмена'
          : 'Ссылка скопирована (нужен HTTPS для системного шаринга)';
        useToastStore.getState().add(
          result === 'shared' ? 'Ссылка отправлена' : copiedMsg,
          'success',
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        useToastStore.getState().add('Не удалось поделиться ссылкой', 'error');
      });
  }, [event]);

  const participantChips = useMemo(() => {
    const sorted = [
      ...participants.filter(p => p.accountId === accountId),
      ...participants.filter(p => p.accountId !== accountId),
    ];
    return sorted.map(p => ({
      accountId: p.accountId,
      login: p.login,
      avatarId: p.avatarId ?? null,
      firstName: p.firstName,
      lastName: p.lastName,
      isMe: p.accountId === accountId,
    }));
  }, [participants, accountId]);

  if (loading) return <PageSkeleton />;
  if (pageAccessDenied) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <button type="button" className={styles.deniedBackBtn} onClick={() => navigate(-1)} aria-label="Назад">
            <ChevronLeft />
          </button>
          <AccessDeniedGate denied variant="page">
            <EventCardDeniedPlaceholder />
          </AccessDeniedGate>
        </div>
      </div>
    );
  }
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
  const participantCap = maxPersons != null && maxPersons > 0 ? maxPersons : null;
  const isParticipantLimitFull =
    participantCap != null && participants.length >= participantCap && !isParticipating;
  const isEventActive = event.active;
  const eventFinished = isEventFinished(event.startTime, event.endTime);
  const allowUsersToInvite = event.parameters?.allowUsersToInvite;
  const canUsersInviteByEventPolicy = allowUsersToInvite === null || allowUsersToInvite === undefined || allowUsersToInvite === true;
  const canOpenInviteModal = !eventFinished && !!accountId && !!event?.id
    && (isOrganizer || (isParticipating && canUsersInviteByEventPolicy));
  const joinDisabled =
    actionLoading ||
    !accountId ||
    isOrganizer ||
    (!isEventActive && !isParticipating) ||
    isParticipantLimitFull;
  const fillPct = maxPersons ? Math.round((participants.length / maxPersons) * 100) : null;

  const onJoinClick = () => {
    if (isParticipantLimitFull) {
      triggerParticipantLimitFeedback();
      return;
    }
    void handleParticipate();
  };

  const scrollToTop = () => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Участники: текущий пользователь — первым
  const sortedParticipants = [
    ...participants.filter(p => p.accountId === accountId),
    ...participants.filter(p => p.accountId !== accountId),
  ];
  const showParticipantsBlock =
    participantsDenied || sortedParticipants.length > 0 || maxPersons != null;

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.card}>

        {/* ── Hero ── */}
        <div className={styles.hero}>
          <EventHeroCover
            event={event}
            headAlbumFileIds={headAlbumFileIds}
            fallbackBackground={getEventCoverBackground(event)}
          />
          <div className={styles.heroOverlay} />

          <div className={styles.heroTop}>
            <button className={styles.heroBtn} onClick={() => navigate(-1)} aria-label="Назад"><ChevronLeft /></button>
            <div className={styles.heroTopRight}>
              <button className={styles.heroBtn} onClick={() => void handleShare()} aria-label="Поделиться" title="Поделиться">
                <ShareIcon />
              </button>
              {/* Меню организатора */}
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
                        <button className={styles.mobileMenuItem} onClick={() => { setBwListOpen(true); setMobileMenuOpen(false); }}>
                          {event.parameters?.private ? '✅ Белый список' : '⛔ Черный список'}
                        </button>
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
            {!isEventActive && <span className={styles.tagCancelled}>Отменено</span>}
          </div>
        </div>

        {/* ── Action row ── */}
        <div className={styles.actionRow}>
          <h1 className={styles.actionTitle}>{event.name}</h1>
          <RatingWidget
            eventId={id!}
            eventStartTime={event.startTime}
            eventEndTime={event.endTime}
            accountId={accountId}
            eventActive={isEventActive}
          />
          <div className={styles.actionBtns}>
            {canOpenInviteModal && (
              <button className={styles.btnInvite} title="Пригласить" onClick={() => setInviteModalOpen(true)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round">
                  <circle cx="9" cy="7" r="4"/><path d="M3 21v-1a6 6 0 0 1 9.29-5"/><circle cx="19" cy="17" r="4"/>
                  <line x1="19" y1="14" x2="19" y2="20"/><line x1="16" y1="17" x2="22" y2="17"/>
                </svg>
              </button>
            )}
            {!eventFinished && !isOrganizer && (
              <div className={styles.joinBtnWrap}>
                {limitNotice && isParticipantLimitFull && (
                  <div className={styles.joinLimitNotice} role="status">
                    Достигнут лимит участников ({participantCap})
                  </div>
                )}
                <button
                  type="button"
                  className={`${styles.btnJoin} ${isParticipating ? styles.btnLeave : ''} ${joinShake ? styles.btnJoinShake : ''}`}
                  onClick={onJoinClick}
                  disabled={joinDisabled}
                  title={
                    isParticipantLimitFull
                      ? `Достигнут лимит участников (${participantCap})`
                      : undefined
                  }
                >
                  {actionLoading ? '...' : isParticipating ? 'Покинуть' : 'Участвовать'}
                </button>
              </div>
            )}
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

            {/* Цена */}
            <div className={styles.priceBlock}>
              <div className={cost === 0 ? styles.priceVal : styles.priceValPaid}>
                {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
              </div>
              {cost === 0
                ? <span className={styles.priceBadge}>Free</span>
                : (
                  <button
                    type="button"
                    className={styles.buyTicketBtn}
                    onClick={e => e.stopPropagation()}
                  >
                    Купить билет
                  </button>
                )}
            </div>

            {showParticipantsBlock && (
              <AccessDeniedGate denied={participantsDenied} variant="section">
                {participantsDenied ? (
                  <SectionDeniedPlaceholder lines={3} />
                ) : (
                  <button
                    type="button"
                    className={styles.participantsBlock}
                    onClick={() => setParticipantsModalOpen(true)}
                    aria-label={`Участники: ${sortedParticipants.length}`}
                  >
                    <div className={styles.participantsBlockHead}>
                      <span className={styles.participantsBlockTitle}>
                        Участники ({sortedParticipants.length})
                      </span>
                      {maxPersons != null && (
                        <span className={styles.participantsBlockCap}>
                          {participants.length} / {maxPersons}
                        </span>
                      )}
                    </div>

                    {maxPersons != null && (
                      <div className={styles.participantsFillTrack}>
                        <div
                          className={styles.fillInner}
                          style={{ width: `${Math.min(fillPct ?? 0, 100)}%` }}
                        />
                      </div>
                    )}

                    {sortedParticipants.length > 0 && (
                      <ParticipantsChipPreview participants={participantChips} />
                    )}
                  </button>
                )}
              </AccessDeniedGate>
            )}

            {/* Альбомы */}
            <EventAlbums
              eventId={id!}
              compact
              canManage={isOrganizer}
              isParticipating={isParticipating}
              accountId={accountId}
            />

            {/* Организаторы */}
            {(organizers.length > 0 || organizersDenied) && (
              <AccessDeniedGate denied={organizersDenied} variant="section">
                {organizersDenied ? (
                  <SectionDeniedPlaceholder lines={3} />
                ) : (
                  <div className={styles.orgsSection}>
                    <div className={styles.secLabel}>Организаторы</div>
                    {organizers.map(o => (
                      <div key={o.accountId} className={styles.orgChip} onClick={() => navigate(`/user/${o.accountId}`)}>
                        <UserAvatar
                          accountId={o.accountId}
                          avatarId={o.avatarId ?? null}
                          initials={(o.firstName?.[0] ?? o.login?.[0] ?? '?').toUpperCase()}
                          size={36}
                          className={styles.orgChipAvatar}
                        />
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
              </AccessDeniedGate>
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
                <button
                  type="button"
                  className={styles.descToggle}
                  onClick={() => setDescExpanded(v => !v)}
                  aria-expanded={descExpanded}
                >
                  <span className={styles.descToggleLine} aria-hidden />
                  <span className={styles.descToggleBody}>
                    <span className={styles.descToggleTitle}>
                      {descExpanded ? 'Свернуть' : 'Показать полностью'}
                    </span>
                    <span className={styles.descToggleHint}>
                      {descExpanded ? 'Скрыть описание' : 'Развернуть описание'}
                    </span>
                  </span>
                  {descExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
              )}
            </div>

            {/* Карта */}
            {event.latitude != null && event.longitude != null && (
              <div>
                <div className={styles.secLabel}>Место проведения</div>
                <div className={styles.mapBlock}>
                  <button
                    type="button"
                    className={styles.mapExpandBtn}
                    onClick={() => setMapModalOpen(true)}
                    aria-label="Развернуть карту"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
                    </svg>
                    Развернуть
                  </button>
                  <YandexMap lat={event.latitude} lng={event.longitude} label={event.name} zoom={14} draggable={false} />
                </div>
              </div>
            )}

            {id && (
              <EventDiscussionsPanel
                eventId={id}
                currentAccountId={accountId}
                canManage={isOrganizer}
              />
            )}

          </div>
        </div>{/* end mainGrid */}
      </div>{/* end card */}

      {cancelConfirm && (
        <CancelConfirmDialog eventName={event.name} loading={actionLoading}
          onConfirm={handleCancelEvent} onClose={() => setCancelConfirm(false)} />
      )}
      {participantsModalOpen && (
        <ParticipantsModal eventId={id!} organizerIds={organizerIds}
          currentAccountId={accountId} onClose={() => setParticipantsModalOpen(false)} />
      )}
      {inviteModalOpen && accountId && event?.id && (
        <InviteModal
          eventId={event.id}
          currentAccountId={accountId}
          isPrivate={!!event.parameters?.private}
          onClose={() => setInviteModalOpen(false)}
        />
      )}
      {addOrgModalOpen && accountId && id && (
        <AddOrganizerModal
          eventId={id}
          currentAccountId={accountId}
          existingOrganizerIds={organizerIds}
          onClose={() => setAddOrgModalOpen(false)}
          onSuccess={() => void refetchOrganizers()}
        />
      )}
      {bwListOpen && id && (
        <BWListModal
          eventId={id}
          listType={event.parameters?.private ? 'whiteList' : 'blackList'}
          onClose={() => setBwListOpen(false)}
        />
      )}
      {mapModalOpen && event.latitude != null && event.longitude != null && (
        <EventMapModal
          lat={event.latitude}
          lng={event.longitude}
          label={event.name}
          address={event.address}
          onClose={() => setMapModalOpen(false)}
        />
      )}

      <button
        type="button"
        className={`${styles.scrollTopBtn} ${showScrollTop ? styles.scrollTopBtnVisible : ''}`}
        onClick={scrollToTop}
        aria-label="Наверх"
        aria-hidden={!showScrollTop}
        tabIndex={showScrollTop ? 0 : -1}
      >
        <ChevronUpIcon />
        <span>Наверх</span>
      </button>
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

function EventCardDeniedPlaceholder() {
  return (
    <div className={styles.deniedPlaceholder}>
      <div className={styles.deniedHero} />
      <div className={styles.deniedBody}>
        <div className={styles.deniedLine} style={{ width: '72%', height: 22 }} />
        <div className={styles.deniedLine} style={{ width: '48%', height: 14 }} />
        <div className={styles.deniedLine} style={{ width: '100%', height: 48 }} />
        <div className={styles.deniedLine} style={{ width: '88%', height: 72 }} />
      </div>
    </div>
  );
}

function SectionDeniedPlaceholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.sectionDeniedPlaceholder}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={styles.deniedLine} style={{ width: `${90 - i * 12}%` }} />
      ))}
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

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronLeft() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>; }
function ShareIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>; }
function StarIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function CalendarIcon(){ return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function PinIcon()     { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function PeopleIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function MoneyIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
