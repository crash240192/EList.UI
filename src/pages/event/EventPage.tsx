// pages/event/EventPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent, IParticipantView, IEventOrganizator } from '@/entities/event';
import {
  fetchEventById,
  participateEvent,
  leaveEvent,
  fetchEventParticipants,
  fetchEventParameters,
  fetchEventOrganizators,
  startEvent,
  finishEvent,
  MOCK_EVENTS,
} from '@/entities/event';
import { useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import { UserChip } from '@/entities/user/ui/UserChip';
import { YandexMap } from '@/features/event-map/YandexMap';
import styles from './EventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export default function EventPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId } = useAccountId();

  const [event,        setEvent]        = useState<IEvent | null>(null);
  const [participants, setParticipants] = useState<IParticipantView[]>([]);
  const [organizers,   setOrganizers]   = useState<IEventOrganizator[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['description'])
  );

  // Является ли текущий пользователь участником
  const isParticipating = !!accountId && participants.some(p => p.accountId === accountId);
  // Является ли организатором
  const isOrganizer = !!accountId && organizers.some(o => o.accountId === accountId);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const loadEvent = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id);

    const loadParts = USE_MOCK
      ? Promise.resolve([] as IParticipantView[])
      : fetchEventParticipants(id);

    const loadParams = USE_MOCK
      ? Promise.resolve(null)
      : fetchEventParameters(id);

    const loadOrgs = USE_MOCK
      ? Promise.resolve([] as IEventOrganizator[])
      : fetchEventOrganizators(id);

    Promise.all([loadEvent, loadParts, loadParams, loadOrgs])
      .then(([ev, parts, params, orgs]) => {
        // Обогащаем событие параметрами из отдельного эндпоинта
        if (params) {
          ev = { ...ev, parameters: { ...params } };
        }
        setEvent(ev);
        setParticipants(parts);
        setOrganizers(orgs);
      })
      .finally(() => setLoading(false));
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
        setParticipants(prev => [...prev, { accountId, login: '', firstName: null, lastName: null }]);
      }
    } finally {
      setActionLoading(false);
    }
  }, [id, accountId, isParticipating]);

  const toggleSection = (key: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading) return <PageSkeleton />;
  if (!event) return (
    <div className={styles.error}>
      <span>😕</span><p>Мероприятие не найдено</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const cost = event.parameters?.cost ?? 0;

  return (
    <div className={styles.page}>
      {/* Cover */}
      <div className={styles.cover}>
        <div
          className={styles.coverBg}
          style={{ background: event.coverUrl ? undefined : 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          {event.coverUrl && <img src={event.coverUrl} alt={event.name} className={styles.coverImg} />}
        </div>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        <button className={styles.photosBtn}>📷 Фото</button>
        {event.eventType && (
          <div className={styles.coverBadges}>
            <span className={styles.categoryBadge}>{event.eventType.eventCategory?.name}</span>
            <span className={styles.typeBadge}>{event.eventType.name}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{event.name}</h1>
          {event.anticipationRating != null && (
            <span className={styles.rating}>⭐ {event.anticipationRating.toFixed(1)}</span>
          )}
        </div>

        <div className={styles.quickMeta}>
          <span>📅 {formatDateRange(event.startTime, event.endTime)}</span>
          {event.address && <span>📍 {event.address}</span>}
          <span className={cost === 0 ? styles.free : styles.paid}>
            {cost === 0 ? '🎉 Бесплатно' : `💰 ${cost.toLocaleString('ru-RU')} ₽`}
          </span>
          {event.parameters?.ageLimit ? <span className={styles.ageLimit}>{event.parameters.ageLimit}+</span> : null}
          {participants.length > 0 && <span>👥 {participants.length}</span>}
        </div>

        {/* Mini-map */}
        {event.latitude != null && event.longitude != null && (
          <div className={styles.miniMapWrap}>
            <YandexMap
              lat={event.latitude}
              lng={event.longitude}
              label={event.name}
            />
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {isOrganizer ? (
            // Организатор — кнопка редактировать вместо участвовать
            <button
              className={styles.primaryBtn}
              onClick={() => navigate(`/edit-event/${event.id}`)}
            >
              ✏️ Редактировать
            </button>
          ) : (
            // Обычный участник
            <button
              className={`${styles.primaryBtn} ${isParticipating ? styles.leaveBtn : ''}`}
              onClick={handleParticipate}
              disabled={actionLoading || !accountId}
            >
              {actionLoading
                ? <span className={styles.spinner} />
                : isParticipating ? 'Покинуть событие' : 'Участвовать'}
            </button>
          )}

          {!isOrganizer && cost > 0 && !isParticipating && (
            <button className={styles.buyBtn}>Купить билет</button>
          )}

          <button
            className={`${styles.iconBtn} ${isFavorite(event.id) ? styles.favActive : ''}`}
            onClick={() => toggleFav(event.id)}
            title="Избранное"
          >❤️</button>

          {isOrganizer && (
            <button
              className={styles.iconBtn}
              onClick={() => event.active ? finishEvent(event.id) : startEvent(event.id)}
              title={event.active ? 'Завершить' : 'Начать'}
            >
              {event.active ? '🏁' : '▶️'}
            </button>
          )}
        </div>

        {/* Sections */}
        <div className={styles.sections}>
          <Section id="description" title="Описание"
            open={openSections.has('description')} onToggle={() => toggleSection('description')}>
            <p className={styles.description}>{event.description ?? 'Описание отсутствует'}</p>
          </Section>

          <Section id="participants" title={`Участники (${participants.length})`}
            open={openSections.has('participants')} onToggle={() => toggleSection('participants')}>
            <ParticipantsList participants={participants} currentAccountId={accountId} />
          </Section>

          {organizers.length > 0 && (
            <Section id="organizers" title={`Организаторы (${organizers.length})`}
              open={openSections.has('organizers')} onToggle={() => toggleSection('organizers')}>
              <div className={styles.participantsList}>
                {organizers.map(o => (
                  <UserChip key={o.accountId} user={{
                    accountId: o.accountId,
                    login: o.login,
                    firstName: o.firstName,
                    lastName: o.lastName,
                    isMe: o.accountId === accountId,
                  }} size="md" />
                ))}
              </div>
            </Section>
          )}

          <Section id="contacts" title="Контакты"
            open={openSections.has('contacts')} onToggle={() => toggleSection('contacts')}>
            <p className={styles.sectionPlaceholder}>Контактная информация организатора</p>
          </Section>

          {isOrganizer && (
            <Section id="management" title="Управление"
              open={openSections.has('management')} onToggle={() => toggleSection('management')}>
              <div className={styles.managementLinks}>
                <button className={styles.managementBtn}>👥 Добавить администратора</button>
                <button className={styles.managementBtn}>✅ Белый список</button>
                <button className={styles.managementBtn}>🚫 Чёрный список</button>
                <button
                  className={`${styles.managementBtn} ${styles.dangerBtn}`}
                  onClick={() => navigate(`/edit-event/${event.id}`)}
                >❌ Отменить мероприятие</button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function ParticipantsList({ participants, currentAccountId }: {
  participants: IParticipantView[];
  currentAccountId: string | null;
}) {
  if (!participants.length) return <p className={styles.sectionPlaceholder}>Пока никто не записался</p>;
  const sorted = [
    ...participants.filter(p => p.accountId === currentAccountId),
    ...participants.filter(p => p.accountId !== currentAccountId),
  ];
  return (
    <div className={styles.participantsList}>
      {sorted.map(p => (
        <UserChip key={p.accountId} user={{
          accountId: p.accountId, login: p.login,
          firstName: p.firstName, lastName: p.lastName,
          isMe: p.accountId === currentAccountId,
        }} size="md" />
      ))}
    </div>
  );
}

function Section({ id, title, open, onToggle, children }: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}


function PageSkeleton() {
  return (
    <div>
      <div style={{ height: 220, background: '#1a1a1a', animation: 'shimmer 1.4s infinite' }} />
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 26, width: '70%', borderRadius: 8, background: '#1a1a1a' }} />
        <div style={{ height: 14, width: '50%', borderRadius: 8, background: '#1a1a1a' }} />
        <div style={{ height: 44, borderRadius: 10, background: '#1a1a1a' }} />
      </div>
    </div>
  );
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));
  return end ? `${fmt(start)} — ${fmt(end)}` : fmt(start);
}
