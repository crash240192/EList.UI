// pages/home/EventModal.tsx

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './EventModal.module.css';

function contrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1a1a2e' : '#ffffff';
}

function categoryGradient(p?: string | null) {
  if (!p) return 'linear-gradient(135deg,#4f46e5,#7c3aed)';
  if (p.startsWith('sport')) return 'linear-gradient(135deg,#10b981,#3b82f6)';
  if (p.startsWith('art'))   return 'linear-gradient(135deg,#f59e0b,#ef4444)';
  if (p.startsWith('food'))  return 'linear-gradient(135deg,#f97316,#fbbf24)';
  return 'linear-gradient(135deg,#4f46e5,#7c3aed)';
}

interface EventModalProps { event: IEvent; onClose: () => void; children?: React.ReactNode; }

export function EventModal({ event, onClose, children }: EventModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const cost       = event.parameters?.cost ?? 0;
  const ageLimit   = event.parameters?.ageLimit;
  const isPrivate  = event.parameters?.private;
  const maxPersons = event.parameters?.maxPersonsCount;
  const gender     = event.parameters?.allowedGender;
  const hasCover   = !!(event.coverImageId || event.coverUrl);

  const hasLimits = isPrivate || maxPersons || gender;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label={event.name}>

        {/* Cover */}
        <div className={styles.cover}
          style={{ background: hasCover ? '#111' : categoryGradient(event.eventType?.eventCategory?.namePath) }}>
          {event.coverImageId ? (
            <AuthImage fileId={event.coverImageId} alt={event.name} className={styles.coverImg}
              fallback={event.coverUrl ? <img src={event.coverUrl} alt={event.name} className={styles.coverImg} /> : undefined} />
          ) : event.coverUrl ? (
            <img src={event.coverUrl} alt={event.name} className={styles.coverImg} />
          ) : null}
          <div className={styles.coverGrad} />

          {/* Кнопка закрытия */}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Бейджи сверху */}
          <div className={styles.topBadges}>
            {ageLimit && ageLimit > 0 && (
              <span className={styles.ageBadge}>{ageLimit}+</span>
            )}
            {isPrivate && (
              <span className={styles.privateBadge}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Приватное
              </span>
            )}
          </div>

          {/* Типы снизу обложки */}
          {((event.eventTypes?.length ?? 0) > 0 || event.eventType) && (
            <div className={styles.typeRow}>
              {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes! : [event.eventType!]).map(t => {
                if (!t) return null;
                const catColor = t.eventCategory?.color ?? '#6366f1';
                const textColor = contrastColor(catColor);
                return (
                  <span key={t.id} className={styles.typeChip} style={{
                    background: `${catColor}55`,
                    border: `1px solid ${catColor}44`,
                    color: textColor,
                  }}>
                    {t.ico && (
                      <img src={t.ico.startsWith('data:') || t.ico.startsWith('http') ? t.ico : `data:image/png;base64,${t.ico}`}
                        alt="" width={12} height={12} style={{ borderRadius: 2, objectFit: 'contain' }} />
                    )}
                    {t.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Заголовок */}
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{event.name}</h2>
          </div>

          {/* Мета */}
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatDateRange(event.startTime, event.endTime)}
            </div>
            {event.address && (
              <div className={styles.metaRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {event.address}
              </div>
            )}
            {(event.participantsCount ?? 0) > 0 && (
              <div className={styles.metaRow}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {event.participantsCount} участников
              </div>
            )}
            <div className={styles.metaRow}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span className={cost === 0 ? styles.metaFree : styles.metaPaid}>
                {cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru-RU')} ₽`}
              </span>
            </div>
          </div>

          {/* Ограничения — возраст уже показан на обложке, выводим остальное */}
          {hasLimits && (
            <div className={styles.limits}>
              {isPrivate && (
                <span className={`${styles.limitBadge} ${styles.limitPrivate}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Только по списку
                </span>
              )}
              {maxPersons && (
                <span className={`${styles.limitBadge} ${styles.limitPersons}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  до {maxPersons} мест
                </span>
              )}
              {gender && (
                <span className={`${styles.limitBadge} ${styles.limitGender}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {gender === 'Male' ? 'Только мужчины' : 'Только женщины'}
                </span>
              )}
            </div>
          )}

          {/* Описание — 3 строки */}
          {event.description && (
            <p className={styles.description}>{event.description}</p>
          )}

          {/* Кнопка */}
          <div className={styles.actions}>
            <button className={styles.primaryBtn}
              onClick={() => { onClose(); navigate(`/event/${event.id}`); }}>
              Подробнее →
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function formatDateRange(start: string, end: string | null) {
  const fmt = (iso: string) => new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
  return end ? `${fmt(start)} — ${fmt(end)}` : fmt(start);
}
