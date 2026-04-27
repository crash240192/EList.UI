// entities/event/ui/EventCard.tsx

import React, { createContext, useContext } from 'react';
import type { IEvent } from '../types';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { icoToUrl } from '@/shared/lib/icoToUrl';
import styles from './EventCard.module.css';

interface EventCardContextValue { event: IEvent; }
const EventCardContext = createContext<EventCardContextValue | null>(null);
function useEventCard() {
  const ctx = useContext(EventCardContext);
  if (!ctx) throw new Error('EventCard subcomponent must be inside <EventCard>');
  return ctx;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function formatPrice(cost: number) {
  return cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`;
}
function categoryGradient(p?: string | null) {
  if (!p) return 'linear-gradient(135deg,#6366f1,#8b5cf6)';
  if (p.startsWith('music'))  return 'linear-gradient(135deg,#6366f1,#8b5cf6)';
  if (p.startsWith('sport'))  return 'linear-gradient(135deg,#10b981,#3b82f6)';
  if (p.startsWith('art'))    return 'linear-gradient(135deg,#f59e0b,#ef4444)';
  if (p.startsWith('food'))   return 'linear-gradient(135deg,#f97316,#fbbf24)';
  return 'linear-gradient(135deg,#6366f1,#8b5cf6)';
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
  const gradient = fallbackGradient ?? categoryGradient(event.eventType?.eventCategory?.namePath);
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
        {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes : event.eventType ? [event.eventType] : [])!.slice(0, 2).map(t => {
          const catColor = t.eventCategory?.color ?? '#6366f1';
          return (
            <div key={t.id} className={styles.typeBadge} style={{
              background: `${catColor}55`,
              border: `1px solid ${catColor}99`,
              color: '#ffffff',
            }}>
              {t.ico && (
                <img src={icoToUrl(t.ico) ?? ''} className="event-type-ico"
                  alt={t.name} width={12} height={12} style={{ objectFit: 'contain', borderRadius: 2 }} />
              )}
              <span>{t.name}</span>
            </div>
          );
        })}
      </div>
      {(event.parameters?.ageLimit ?? 0) > 0 && (
        <span className={styles.ageBadge}>{event.parameters!.ageLimit}+</span>
      )}
      {event.parameters?.private && <span className={styles.privateBadge}>🔒</span>}
    </div>
  );
}

// ---- Body / Title / Meta / Footer / Price / Participants / FavoriteButton / Rating ----

function Body({ children }: { children: React.ReactNode }) { return <div className={styles.body}>{children}</div>; }
function Title() { const { event } = useEventCard(); return <h3 className={styles.title}>{event.name}</h3>; }

function Meta() {
  const { event } = useEventCard();
  return (
    <div className={styles.meta}>
      <span className={styles.metaItem}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {formatDate(event.startTime)}
      </span>
      {event.address && (
        <span className={styles.metaItem}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
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

interface FavoriteButtonProps { isFavorite: boolean; onToggle: (id: string, cur: boolean) => void; }
function FavoriteButton({ isFavorite, onToggle }: FavoriteButtonProps) {
  const { event } = useEventCard();
  return (
    <button
      className={`${styles.favBtn} ${isFavorite ? styles.favActive : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle(event.id, isFavorite); }}
      aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
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
interface PresetProps { event: IEvent; onClick?: (e: IEvent) => void; onFavorite?: (id: string, cur: boolean) => void; isFavorite?: boolean; className?: string; }
function Preset({ event, onClick, onFavorite, isFavorite = false, className }: PresetProps) {
  return (
    <EventCard event={event} onClick={onClick} className={className}>
      <Cover />
      <Body>
        <Title />
        <Meta />
        <Footer>
          <div className={styles.footerLeft}><Price /><Rating /><Participants /></div>
          {onFavorite && <FavoriteButton isFavorite={isFavorite} onToggle={onFavorite} />}
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
EventCard.FavoriteButton = FavoriteButton;
EventCard.Preset = Preset;

export { EventCard };
export type { EventCardProps, FavoriteButtonProps, PresetProps };
