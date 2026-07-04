import type { ReactNode } from 'react';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { EventTypeChip } from '@/shared/ui/EventTypeChip';
import {
  formatEventListItemDate,
  formatEventListItemPrice,
  getEventListCoverBackground,
  getEventListParams,
  getEventListTypes,
  type EventListItemData,
} from '@/entities/event/lib/eventListItemUtils';
import styles from './EventListItem.module.css';

export type EventListUrgencyKind = 'hot' | 'soon' | 'ok';

export interface EventListUrgency {
  label: string;
  kind: EventListUrgencyKind;
}

interface EventListItemProps {
  event: EventListItemData;
  onClick?: () => void;
  className?: string;
  urgency?: EventListUrgency | null;
  unviewed?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  showChevron?: boolean;
}

function ClockIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function EventListItem({
  event,
  onClick,
  className,
  urgency,
  unviewed,
  header,
  footer,
  actions,
  showChevron,
}: EventListItemProps) {
  const types = getEventListTypes(event);
  const params = getEventListParams(event);
  const price = formatEventListItemPrice(params.cost);
  const coverBg = getEventListCoverBackground(event);
  const dateLabel = formatEventListItemDate(event.startTime);

  const urgClass = urgency?.kind === 'hot'
    ? styles.urgHot
    : urgency?.kind === 'soon'
      ? styles.urgSoon
      : styles.urgOk;

  const showParticipants = params.participantsCount != null;

  return (
    <div
      className={[
        styles.item,
        urgency?.kind === 'hot' ? styles.itemUrgent : '',
        unviewed ? styles.itemUnviewed : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={styles.main}
        onClick={onClick}
        disabled={!onClick}
      >
        <div className={styles.cover} style={{ background: coverBg }}>
          {event.coverImageId ? (
            <AuthImage
              fileId={event.coverImageId}
              alt=""
              className={styles.coverImg}
              fallback={
                event.coverUrl
                  ? <img src={event.coverUrl} alt="" className={styles.coverImg} />
                  : <div className={styles.coverPlaceholder} />
              }
            />
          ) : event.coverUrl ? (
            <img src={event.coverUrl} alt="" className={styles.coverImg} />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
          {urgency && (
            <span className={`${styles.urgBadge} ${urgClass}`}>{urgency.label}</span>
          )}
        </div>

        <div className={styles.content}>
          {header && <div className={styles.header}>{header}</div>}

          <div className={styles.name}>{event.name}</div>

          <div className={styles.meta}>
            {dateLabel && (
              <span className={styles.metaItem}>
                <ClockIcon />
                {dateLabel}
              </span>
            )}
            {event.address && (
              <span className={styles.metaItem}>
                <PinIcon />
                {event.address}
              </span>
            )}
            <span className={`${styles.metaItem} ${price.free ? styles.metaFree : styles.metaPaid}`}>
              {price.label}
            </span>
            {params.ageLimit != null && params.ageLimit > 0 && (
              <span className={styles.metaItem}>{params.ageLimit}+</span>
            )}
          </div>

          {types.length > 0 && (
            <div className={styles.chips}>
              {types.map(type => (
                <EventTypeChip
                  key={type.id}
                  type={type}
                  variant="soft"
                  className={styles.chip}
                  iconSize={10}
                />
              ))}
            </div>
          )}

          {(footer || showParticipants) && (
            <div className={styles.footer}>
              {showParticipants && (
                <span className={styles.footerItem}>
                  <PeopleIcon />
                  {params.participantsCount}
                  {params.maxPersonsCount ? ` / ${params.maxPersonsCount}` : ''} участников
                </span>
              )}
              {footer}
            </div>
          )}
        </div>

        {showChevron && (
          <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>

      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function EventList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`${styles.list} ${className ?? ''}`}>{children}</div>;
}
