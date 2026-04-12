// pages/event/EventPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import type { IParticipant } from '@/entities/event';
import {
  fetchEventById,
  participateEvent,
  leaveEvent,
  fetchEventParticipants,
  startEvent,
  finishEvent,
  MOCK_EVENTS,
} from '@/entities/event';
import { useFavoritesStore } from '@/app/store';
import { useAccountId } from '@/features/auth/useAccountId';
import styles from './EventPage.module.css';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export default function EventPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { accountId } = useAccountId();

  const [event, setEvent]               = useState<IEvent | null>(null);
  const [participants, setParticipants] = useState<IParticipant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['description']));

  // Является ли текущий пользователь участником — вычисляется из списка участников
  const isParticipating = !!accountId && participants.some(p => p.id === accountId);

  // ---- Загрузка события и участников ----
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const loadEvent = USE_MOCK
      ? Promise.resolve(MOCK_EVENTS.find(e => e.id === id) ?? MOCK_EVENTS[0])
      : fetchEventById(id);

    const loadParticipants = USE_MOCK
      ? Promise.resolve([] as IParticipant[])
      : fetchEventParticipants(id);

    Promise.all([loadEvent, loadParticipants])
      .then(([ev, parts]) => {
        setEvent(ev);
        setParticipants(parts);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ---- Участие ----
  const handleParticipate = useCallback(async () => {
    if (!id || !accountId) return;
    setActionLoading(true);
    try {
      if (isParticipating) {
        await leaveEvent(id);
        setParticipants(prev => prev.filter(p => p.id !== accountId));
      } else {
        await participateEvent(id);
        setParticipants(prev => [...prev, { id: accountId }]);
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

  // ---- Render ----
  if (loading) return <PageSkeleton />;
  if (!event)  return (
    <div className={styles.error}>
      <span>😕</span><p>Мероприятие не найдено</p>
      <button onClick={() => navigate(-1)}>← Назад</button>
    </div>
  );

  const cost       = event.parameters?.cost ?? 0;
  const isOrganizer = event.isOrganizer ?? false;

  return (
    <div className={styles.page}>
      {/* ---- Cover ---- */}
      <div className={styles.cover}>
        <div
          className={styles.coverBg}
          style={{ background: event.coverUrl ? undefined : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {event.coverUrl && <img src={event.coverUrl} alt={event.name} className={styles.coverImg} />}
        </div>

        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Назад">←</button>
        <button className={styles.photosBtn}>📷 Фото</button>

        {event.eventType && (
          <div className={styles.coverBadges}>
            <span className={styles.categoryBadge}>{event.eventType.eventCategory?.name}</span>
            <span className={styles.typeBadge}>{event.eventType.name}</span>
          </div>
        )}
      </div>

      {/* ---- Content ---- */}
      <div className={styles.content}>
        {/* Title */}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{event.name}</h1>
          {event.anticipationRating != null && (
            <span className={styles.rating}>⭐ {event.anticipationRating.toFixed(1)}</span>
          )}
        </div>

        {/* Meta chips */}
        <div className={styles.quickMeta}>
          <span>📅 {formatDateRange(event.startTime, event.endTime)}</span>
          {event.address && <span>📍 {event.address}</span>}
          <span className={cost === 0 ? styles.free : styles.paid}>
            {cost === 0 ? '🎉 Бесплатно' : `💰 ${cost.toLocaleString('ru-RU')} ₽`}
          </span>
          {event.parameters?.ageLimit && (
            <span className={styles.ageLimit}>{event.parameters.ageLimit}+</span>
          )}
          {participants.length > 0 && (
            <span>👥 {participants.length} участников</span>
          )}
        </div>

        {/* ---- Actions ---- */}
        <div className={styles.actions}>
          {!isOrganizer && (
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

          <button className={styles.iconBtn} title="Оценить ожидание">⭐</button>

          {isOrganizer && (
            <>
              <button className={styles.organizerBtn} onClick={() => navigate(`/edit-event/${event.id}`)}>
                ✏️ Редактировать
              </button>
              <button className={styles.organizerBtn} onClick={() => event.active ? finishEvent(event.id) : startEvent(event.id)}>
                {event.active ? '🏁 Завершить' : '▶️ Начать'}
              </button>
            </>
          )}
        </div>

        {/* ---- Accordion ---- */}
        <div className={styles.sections}>
          <Section
            id="description"
            title="Описание"
            open={openSections.has('description')}
            onToggle={() => toggleSection('description')}
          >
            <p className={styles.description}>{event.description ?? 'Описание отсутствует'}</p>
          </Section>

          <Section
            id="participants"
            title={`Участники (${participants.length})`}
            open={openSections.has('participants')}
            onToggle={() => toggleSection('participants')}
          >
            <ParticipantsList participants={participants} currentAccountId={accountId} />
          </Section>

          <Section
            id="contacts"
            title="Контакты организатора"
            open={openSections.has('contacts')}
            onToggle={() => toggleSection('contacts')}
          >
            <p className={styles.sectionPlaceholder}>Контактная информация организатора</p>
          </Section>

          {isOrganizer && (
            <Section
              id="management"
              title="Управление"
              open={openSections.has('management')}
              onToggle={() => toggleSection('management')}
            >
              <div className={styles.managementLinks}>
                <button className={styles.managementBtn}>👥 Добавить администратора</button>
                <button className={styles.managementBtn}>✅ Белый список</button>
                <button className={styles.managementBtn}>🚫 Чёрный список</button>
                <button
                  className={`${styles.managementBtn} ${styles.dangerBtn}`}
                  onClick={() => navigate(`/edit-event/${event.id}`)}
                >
                  ❌ Отменить мероприятие
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Participants list ----

function ParticipantsList({
  participants,
  currentAccountId,
}: {
  participants: IParticipant[];
  currentAccountId: string | null;
}) {
  if (participants.length === 0) {
    return <p className={styles.sectionPlaceholder}>Пока никто не записался</p>;
  }

  // Разделяем: сначала текущий пользователь
  const me     = participants.filter(p => p.id === currentAccountId);
  const others = participants.filter(p => p.id !== currentAccountId);

  return (
    <div className={styles.participantsList}>
      {me.length > 0 && (
        <div className={styles.participantRow} style={{ opacity: 0.9 }}>
          <div className={styles.participantAvatar} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            Я
          </div>
          <span className={styles.participantName}>Вы</span>
          <span className={styles.participantTag}>участник</span>
        </div>
      )}
      {others.map(p => (
        <div key={p.id} className={styles.participantRow}>
          <div className={styles.participantAvatar}>
            {p.login ? p.login[0].toUpperCase() : '?'}
          </div>
          <span className={styles.participantName}>{p.login ?? p.id.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Section accordion ----

function Section({
  id, title, open, onToggle, children,
}: {
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

// ---- Skeleton & helpers ----

function PageSkeleton() {
  return (
    <div style={{ padding: 0 }}>
      <div style={{ height: 240, background: '#1a1a1a', animation: 'shimmer 1.4s infinite' }} />
      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 28, width: '70%', borderRadius: 8, background: '#1a1a1a' }} />
        <div style={{ height: 16, width: '50%', borderRadius: 8, background: '#1a1a1a' }} />
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
