// pages/home/EventModal.tsx
// Всплывающий превью при клике на карте. Кнопка "Участвовать" только на странице события.

import { useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { useFavoritesStore } from '@/app/store';
import { useState, useEffect } from 'react';
import styles from './EventModal.module.css';

interface EventModalProps {
  event: IEvent;
  onClose: () => void;
}

export function EventModal({ event, onClose }: EventModalProps) {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const cost = event.parameters?.cost ?? 0;

  const openDetail = () => {
    onClose();
    navigate(`/event/${event.id}`);
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />

      <div className={styles.modal} role="dialog" aria-modal aria-label={event.name}>
        {/* Cover */}
        <div
          className={styles.cover}
          style={{ background: event.coverUrl ? undefined : 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          {event.coverUrl && <img src={event.coverUrl} alt={event.name} className={styles.coverImg} />}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
          {event.eventType && <span className={styles.badge}>{event.eventType.name}</span>}
        </div>

        {/* Body */}
        <div className={styles.body}>
          <h2 className={styles.title}>{event.name}</h2>

          <div className={styles.meta}>
            <MetaRow icon="📅" text={formatDateRange(event.startTime, event.endTime)} />
            {event.address && <MetaRow icon="📍" text={event.address} />}
            <MetaRow icon="💰" text={cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`} />
            {event.participantsCount != null && (
              <MetaRow icon="👥" text={`${event.participantsCount} участников`} />
            )}
          </div>

          {event.description && (
            <p className={styles.description}>{event.description}</p>
          )}

          {/* Actions — только "Подробнее" и избранное */}
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={openDetail}>
              Подробнее →
            </button>
            <button
              className={`${styles.iconActionBtn} ${isFavorite(event.id) ? styles.favActive : ''}`}
              onClick={() => toggleFav(event.id)}
              title="В избранное"
            >
              ❤️
            </button>
          </div>
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
