import type { ReactNode } from 'react';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { EventTypeChipsOverflow } from '@/shared/ui/EventTypeChipsOverflow';
import {
  formatEventListItemDate,
  formatEventListItemPrice,
  getEventListCoverBackground,
  getEventListParams,
  getEventTypes,
  type EventListItemData,
} from '@/entities/event/lib/eventListItemUtils';
import { resolveAgeLimitBadge } from '@/shared/lib/ageLimit';
import { coverFocusFromEvent, coverFocusImgStyle } from '@/shared/lib/coverFocus';
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
  /** На мобилке обложка на всю высоту слева с градиентным затуханием */
  bleedCover?: boolean;
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

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
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
  bleedCover,
}: EventListItemProps) {
  const params = getEventListParams(event);
  const price = formatEventListItemPrice(params.cost);
  const coverBg = getEventListCoverBackground(event);
  const dateLabel = formatEventListItemDate(event.startTime);
  const hasTypes = getEventTypes(event).length > 0;

  const urgClass = urgency?.kind === 'hot'
    ? styles.urgHot
    : urgency?.kind === 'soon'
      ? styles.urgSoon
      : styles.urgOk;

  const showParticipants = params.participantsCount != null;
  const focusStyle = coverFocusImgStyle(coverFocusFromEvent(event));

  return (
    <div
      className={[
        styles.item,
        urgency?.kind === 'hot' ? styles.itemUrgent : '',
        unviewed ? styles.itemUnviewed : '',
        bleedCover ? styles.bleedCover : '',
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
              style={focusStyle}
              fallback={
                event.coverUrl
                  ? <img src={event.coverUrl} alt="" className={styles.coverImg} style={focusStyle} />
                  : <div className={styles.coverPlaceholder} />
              }
            />
          ) : event.coverUrl ? (
            <img src={event.coverUrl} alt="" className={styles.coverImg} style={focusStyle} />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
          {urgency && (
            <span className={`${styles.urgBadge} ${urgClass}`}>{urgency.label}</span>
          )}
        </div>

        <div className={styles.content}>
          {header && <div className={styles.header}>{header}</div>}

          {/* 1 — название */}
          <div className={styles.name}>{event.name}</div>

          {/* 2 — дата и место */}
          {(dateLabel || event.address) && (
            <div className={styles.whenWhere}>
              {dateLabel && (
                <span className={styles.metaItem}>
                  <ClockIcon />
                  {dateLabel}
                </span>
              )}
              {event.address && (
                <span className={`${styles.metaItem} ${styles.metaPlace}`}>
                  <PinIcon />
                  {event.address}
                </span>
              )}
            </div>
          )}

          {/* 3 — цена, возраст, закрытость */}
          <div className={styles.badges}>
            <span className={`${styles.badge} ${price.free ? styles.metaFree : styles.metaPaid}`}>
              {price.label}
            </span>
            <span className={`${styles.badge} ${styles.metaAge}`}>
              {resolveAgeLimitBadge(params.ageLimit)}
            </span>
            <span
              className={`${styles.badge} ${params.isPrivate ? styles.badgePrivate : styles.badgePublic}`}
            >
              {params.isPrivate ? <LockIcon /> : null}
              {params.isPrivate ? 'Закрытое' : 'Открытое'}
            </span>
          </div>

          {/* 4 — типы (сколько влезет) + «ещё» */}
          {hasTypes && (
            <EventTypeChipsOverflow
              event={event}
              fitWidth
              variant="soft"
              moreVariant="soft"
              iconSize={10}
              chipClassName={styles.chip}
              className={styles.chips}
            />
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
