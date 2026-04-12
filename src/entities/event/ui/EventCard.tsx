// ============================================================
// entities/event/ui/EventCard.tsx
// Compound Component — карточка мероприятия
//
// Использование (гибкое — Compound Pattern):
//
//   <EventCard event={event} onClick={handleClick}>
//     <EventCard.Cover />
//     <EventCard.Body>
//       <EventCard.Title />
//       <EventCard.Meta />
//       <EventCard.Footer>
//         <EventCard.Price />
//         <EventCard.FavoriteButton onToggle={handleFav} isFavorite={fav} />
//       </EventCard.Footer>
//     </EventCard.Body>
//   </EventCard>
//
// Или предустановленный пресет:
//   <EventCard.Preset event={event} onClick={...} onFavorite={...} isFavorite={...} />
// ============================================================

import React, { createContext, useContext } from 'react';
import type { IEvent } from '../types';
import styles from './EventCard.module.css';

// ---- Context ----

interface EventCardContextValue {
  event: IEvent;
}

const EventCardContext = createContext<EventCardContextValue | null>(null);

function useEventCard(): EventCardContextValue {
  const ctx = useContext(EventCardContext);
  if (!ctx) throw new Error('EventCard subcomponent must be used inside <EventCard>');
  return ctx;
}

// ---- Helpers ----

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatPrice(cost: number): string {
  return cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`;
}

// ---- Root ----

interface EventCardProps {
  event: IEvent;
  onClick?: (event: IEvent) => void;
  className?: string;
  children: React.ReactNode;
}

function EventCard({ event, onClick, className = '', children }: EventCardProps) {
  return (
    <EventCardContext.Provider value={{ event }}>
      <article
        className={`${styles.card} ${onClick ? styles.clickable : ''} ${className}`}
        onClick={onClick ? () => onClick(event) : undefined}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(event) : undefined}
        aria-label={event.name}
      >
        {children}
      </article>
    </EventCardContext.Provider>
  );
}

// ---- Cover (обложка) ----

interface CoverProps {
  fallbackGradient?: string;
}

function Cover({ fallbackGradient }: CoverProps) {
  const { event } = useEventCard();

  const gradient = fallbackGradient ?? categoryGradient(event.eventType?.eventCategory?.namePath);

  return (
    <div className={styles.cover} style={{ background: event.coverUrl ? undefined : gradient }}>
      {event.coverUrl && (
        <img src={event.coverUrl} alt={event.name} className={styles.coverImg} loading="lazy" />
      )}
      {event.eventType && (
        <span className={styles.typeBadge}>{event.eventType.name}</span>
      )}
      {event.active && <span className={styles.activeDot} title="Идёт сейчас" />}
    </div>
  );
}

/** Градиент по умолчанию в зависимости от категории */
function categoryGradient(namePath?: string | null): string {
  if (!namePath) return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  if (namePath.startsWith('music')) return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  if (namePath.startsWith('sport')) return 'linear-gradient(135deg, #10b981, #3b82f6)';
  if (namePath.startsWith('art')) return 'linear-gradient(135deg, #f59e0b, #ef4444)';
  if (namePath.startsWith('food')) return 'linear-gradient(135deg, #f97316, #fbbf24)';
  return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
}

// ---- Body ----

function Body({ children }: { children: React.ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

// ---- Title ----

function Title() {
  const { event } = useEventCard();
  return <h3 className={styles.title}>{event.name}</h3>;
}

// ---- Meta (дата + адрес) ----

function Meta() {
  const { event } = useEventCard();
  return (
    <div className={styles.meta}>
      <span className={styles.metaItem}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {formatDate(event.startTime)}
      </span>
      {event.address && (
        <span className={styles.metaItem}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {event.address}
        </span>
      )}
    </div>
  );
}

// ---- Footer ----

function Footer({ children }: { children: React.ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

// ---- Price ----

function Price() {
  const { event } = useEventCard();
  const cost = event.parameters?.cost ?? 0;
  return (
    <span className={`${styles.price} ${cost === 0 ? styles.priceFree : styles.pricePaid}`}>
      {formatPrice(cost)}
    </span>
  );
}

// ---- Participants ----

function Participants() {
  const { event } = useEventCard();
  if (!event.participantsCount) return null;
  return (
    <span className={styles.participants}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {event.participantsCount}
    </span>
  );
}

// ---- FavoriteButton ----

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (eventId: string, current: boolean) => void;
}

function FavoriteButton({ isFavorite, onToggle }: FavoriteButtonProps) {
  const { event } = useEventCard();

  return (
    <button
      className={`${styles.favBtn} ${isFavorite ? styles.favActive : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(event.id, isFavorite);
      }}
      aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      title={isFavorite ? 'В избранном' : 'В избранное'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

// ---- Rating ----

function Rating() {
  const { event } = useEventCard();
  if (!event.anticipationRating) return null;
  return (
    <span className={styles.rating}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {event.anticipationRating.toFixed(1)}
    </span>
  );
}

// ---- Preset (удобный пресет для быстрого использования) ----

interface PresetProps {
  event: IEvent;
  onClick?: (event: IEvent) => void;
  onFavorite?: (eventId: string, current: boolean) => void;
  isFavorite?: boolean;
  className?: string;
}

function Preset({ event, onClick, onFavorite, isFavorite = false, className }: PresetProps) {
  return (
    <EventCard event={event} onClick={onClick} className={className}>
      <Cover />
      <Body>
        <Title />
        <Meta />
        <Footer>
          <div className={styles.footerLeft}>
            <Price />
            <Rating />
            <Participants />
          </div>
          {onFavorite && <FavoriteButton isFavorite={isFavorite} onToggle={onFavorite} />}
        </Footer>
      </Body>
    </EventCard>
  );
}

// ---- Экспорт в стиле Compound Component ----

EventCard.Cover = Cover;
EventCard.Body = Body;
EventCard.Title = Title;
EventCard.Meta = Meta;
EventCard.Footer = Footer;
EventCard.Price = Price;
EventCard.Rating = Rating;
EventCard.Participants = Participants;
EventCard.FavoriteButton = FavoriteButton;
EventCard.Preset = Preset;

export { EventCard };
export type { EventCardProps, FavoriteButtonProps, PresetProps };
