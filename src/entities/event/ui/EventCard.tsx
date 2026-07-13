// entities/event/ui/EventCard.tsx

import React, { createContext, useContext } from 'react';
import type { IEvent } from '../types';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { EventTypeChip } from '@/shared/ui/EventTypeChip';
import { getEventCoverBackground } from '@/shared/lib/eventCoverGradient';
import styles from './EventCard.module.css';

interface EventCardContextValue { event: IEvent; }
const EventCardContext = createContext<EventCardContextValue | null>(null);
function useEventCard() {
  const ctx = useContext(EventCardContext);
  if (!ctx) throw new Error('EventCard subcomponent must be inside <EventCard>');
  return ctx;
}

/** «сб, 18 июл.» → «Сб, 18 июл» — якорь сканирования списка */
function formatDateBadge(iso: string) {
  const s = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/\./g, '');
}
function formatTime(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function formatPrice(cost: number) {
  return cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`;
}
// ---- Root ----
interface EventCardProps { event: IEvent; onClick?: (e: IEvent) => void; className?: string; children: React.ReactNode; }
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
      >{children}</article>
    </EventCardContext.Provider>
  );
}

// ---- Cover ----
function Cover({ fallbackGradient }: { fallbackGradient?: string }) {
  const { event } = useEventCard();
  const gradient = fallbackGradient ?? getEventCoverBackground(event);
  const hasCover = !!(event.coverImageId || event.coverUrl);

  return (
    <div className={styles.cover} style={{ background: hasCover ? '#111' : gradient }}>
      {event.coverImageId ? (
        <AuthImage fileId={event.coverImageId} alt={event.name} className={styles.coverImg}
          fallback={event.coverUrl ? <img src={event.coverUrl} alt={event.name} className={styles.coverImg} /> : undefined} />
      ) : event.coverUrl ? (
        <img src={event.coverUrl} alt={event.name} className={styles.coverImg} loading="lazy" />
      ) : null}

      <div className={styles.coverOverlay} />

      {/* Бейджи всех типов */}
      <div className={styles.typeBadges}>
        {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes : event.eventType ? [event.eventType] : [])!.slice(0, 2).map(t => (
          <EventTypeChip
            key={t.id}
            type={t}
            variant="overlay"
            className={styles.typeBadge}
            iconSize={12}
          />
        ))}
      </div>
      {(event.parameters?.ageLimit ?? 0) > 0 && (
        <span className={styles.ageBadge}>{event.parameters!.ageLimit}+</span>
      )}
      <div className={styles.coverTopLeft}>
        <span className={styles.dateBadge}>{formatDateBadge(event.startTime)}</span>
        {event.parameters?.private && (
          <span className={styles.privateBadge} aria-label="Приватное">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Body / Title / Meta / Footer / Price / Participants / Rating ----

function Body({ children }: { children: React.ReactNode }) { return <div className={styles.body}>{children}</div>; }
function Title() { const { event } = useEventCard(); return <h3 className={styles.title}>{event.name}</h3>; }

function Meta() {
  const { event } = useEventCard();
  return (
    <div className={styles.meta}>
      <span className={styles.metaItem}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {formatTime(event.startTime)}
      </span>
      {event.address && (
        <span className={styles.metaItem}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {event.address}
        </span>
      )}
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) { return <div className={styles.footer}>{children}</div>; }

function Price() {
  const { event } = useEventCard();
  const cost = event.parameters?.cost ?? 0;
  return (
    <span className={`${styles.price} ${cost === 0 ? styles.priceFree : styles.pricePaid}`}>
      {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
    </span>
  );
}

function Participants() {
  const { event } = useEventCard();
  if (!event.participantsCount) return null;
  return (
    <span className={styles.participants}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      {event.participantsCount}
    </span>
  );
}

function Rating() {
  const { event } = useEventCard();
  if (!event.anticipationRating) return null;
  return (
    <span className={styles.rating}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      {event.anticipationRating.toFixed(1)}
    </span>
  );
}

// ---- Preset ----
interface PresetProps { event: IEvent; onClick?: (e: IEvent) => void; className?: string; }
function Preset({ event, onClick, className }: PresetProps) {
  return (
    <EventCard event={event} onClick={onClick} className={className}>
      <Cover />
      <Body>
        <Title />
        <Meta />
        <Footer>
          <div className={styles.footerLeft}><Price /><Rating /><Participants /></div>
        </Footer>
      </Body>
    </EventCard>
  );
}

EventCard.Cover = Cover;
EventCard.Body = Body;
EventCard.Title = Title;
EventCard.Meta = Meta;
EventCard.Footer = Footer;
EventCard.Price = Price;
EventCard.Rating = Rating;
EventCard.Participants = Participants;
EventCard.Preset = Preset;

export { EventCard };
export type { EventCardProps, PresetProps };
