// pages/home/EventModal.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IEvent } from '@/entities/event';
import { useFavoritesStore } from '@/app/store';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './EventModal.module.css';

function categoryGradient(p?: string | null) {
  if (!p) return 'linear-gradient(135deg,#4f46e5,#7c3aed)';
  if (p.startsWith('sport')) return 'linear-gradient(135deg,#10b981,#3b82f6)';
  if (p.startsWith('art'))   return 'linear-gradient(135deg,#f59e0b,#ef4444)';
  if (p.startsWith('food'))  return 'linear-gradient(135deg,#f97316,#fbbf24)';
  return 'linear-gradient(135deg,#4f46e5,#7c3aed)';
}

interface EventModalProps { event: IEvent; onClose: () => void; }

export function EventModal({ event, onClose }: EventModalProps) {
  const navigate = useNavigate();
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();

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

  const hasLimits = (ageLimit && ageLimit > 0) || isPrivate || maxPersons || gender;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal aria-label={event.name}>

        {/* Ручка */}
        <div className={styles.handle} />

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
              {((event.eventTypes?.length ?? 0) > 0 ? event.eventTypes! : [event.eventType!]).map(t => t && (
                <span key={t.id} className={styles.typeChip}>
                  {t.ico && (
                    <img src={t.ico.startsWith('data:') || t.ico.startsWith('http') ? t.ico : `data:image/png;base64,${t.ico}`}
                      alt="" width={12} height={12} style={{ borderRadius: 2, objectFit: 'contain' }} />
                  )}
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Заголовок + избранное */}
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{event.name}</h2>
            <button
              className={`${styles.favBtn} ${isFavorite(event.id) ? styles.favActive : ''}`}
              onClick={() => toggleFav(event.id)}
              title={isFavorite(event.id) ? 'Убрать из избранного' : 'В избранное'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24"
                fill={isFavorite(event.id) ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
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

          {/* Ограничения */}
          {hasLimits && (
            <div className={styles.limits}>
              {ageLimit && ageLimit > 0 && (
                <span className={`${styles.limitBadge} ${styles.limitAge}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                  {ageLimit}+
                </span>
              )}
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
