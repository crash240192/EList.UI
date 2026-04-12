// pages/home/EventModal.tsx
// Всплывающий модал предпросмотра события — открывается по клику на карте.
// Полная страница события открывается по navigate('/event/:id').

import { useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { useFavoritesStore, useAuthStore } from '@/app/store';
import { participateEvent, leaveEvent } from '@/entities/event';
import { useState, useEffect, useCallback } from 'react';
import styles from './EventModal.module.css';

interface EventModalProps {
  event: IEvent;
  onClose: () => void;
}

export function EventModal({ event, onClose }: EventModalProps) {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const { isAuthenticated } = useAuthStore();
  const [participating, setParticipating] = useState(event.isParticipating ?? false);
  const [loading, setLoading] = useState(false);

  // Закрытие по Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleParticipate = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    setLoading(true);
    try {
      if (participating) await leaveEvent(event.id);
      else await participateEvent(event.id);
      setParticipating((v) => !v);
    } finally {
      setLoading(false);
    }
  }, [participating, event.id, isAuthenticated, navigate]);

  const cost = event.parameters?.cost ?? 0;

  return (
    <>
      {/* Затемнение фона */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden />

      {/* Модал */}
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={event.name}
      >
        {/* Cover */}
        <div
          className={styles.cover}
          style={{
            background: event.coverUrl
              ? undefined
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          }}
        >
          {event.coverUrl && (
            <img src={event.coverUrl} alt={event.name} className={styles.coverImg} />
          )}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
          {event.eventType && (
            <span className={styles.badge}>{event.eventType.name}</span>
          )}
        </div>

        {/* Content */}
        <div className={styles.body}>
          <h2 className={styles.title}>{event.name}</h2>

          <div className={styles.meta}>
            <MetaRow icon="📅" text={formatDateRange(event.startTime, event.endTime)} />
            {event.address && <MetaRow icon="📍" text={event.address} />}
            <MetaRow icon="💰" text={cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`} />
            {event.participantsCount != null && (
              <MetaRow icon="👥" text={`${event.participantsCount} участников`} />
            )}
            {event.anticipationRating != null && (
              <MetaRow icon="⭐" text={`Рейтинг ожидания: ${event.anticipationRating.toFixed(1)}`} />
            )}
          </div>

          {event.description && (
            <p className={styles.description}>{event.description}</p>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={`${styles.primaryBtn} ${participating ? styles.leaveBtn : ''}`}
              onClick={handleParticipate}
              disabled={loading}
            >
              {loading ? '...' : participating ? 'Покинуть событие' : 'Участвовать'}
            </button>

            {cost > 0 && !participating && (
              <button className={styles.buyBtn}>
                Купить билет
              </button>
            )}

            <button
              className={`${styles.iconActionBtn} ${isFavorite(event.id) ? styles.favActive : ''}`}
              onClick={() => toggleFav(event.id)}
              title="В избранное"
            >
              ❤️
            </button>
          </div>

          <button
            className={styles.detailsLink}
            onClick={() => { onClose(); navigate(`/event/${event.id}`); }}
          >
            Подробнее →
          </button>
        </div>
      </div>
    </>
  );
}

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.metaIcon}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  return end ? `${fmt(start)} — ${fmt(end)}` : fmt(start);
}
