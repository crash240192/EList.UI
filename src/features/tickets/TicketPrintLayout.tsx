// features/tickets/TicketPrintLayout.tsx — печатная форма билета (W6d)

import { QrCodeImage } from '@/shared/ui/QrCode/QrCodeImage';
import { BRAND_NAME } from '@/shared/config/brand';
import styles from './TicketPrintLayout.module.css';

export interface TicketPrintData {
  eventName: string;
  startTime?: string | null;
  endTime?: string | null;
  address?: string | null;
  ticketTypeName?: string | null;
  /** null/undefined — цена неизвестна; 0 — «Бесплатно» */
  price?: number | null;
  currency?: string | null;
  code: string;
  orderId?: string | null;
}

function formatWhen(start?: string | null, end?: string | null): string {
  if (!start) return '';
  try {
    const s = new Date(start);
    const date = s.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const t0 = s.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (!end) return `${date}, ${t0}`;
    const e = new Date(end);
    const t1 = e.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${t0}–${t1}`;
  } catch {
    return start;
  }
}

function formatPrice(price?: number | null, currency?: string | null): string | null {
  if (price == null || Number.isNaN(price)) return null;
  if (price <= 0) return 'Бесплатно';
  const suffix = !currency || currency === 'RUB' ? '₽' : currency;
  return `${price.toLocaleString('ru-RU')} ${suffix}`;
}

interface TicketPrintLayoutProps {
  data: TicketPrintData;
  /** id для якоря print CSS */
  rootId?: string;
}

export function TicketPrintLayout({ data, rootId = 'ticket-print-root' }: TicketPrintLayoutProps) {
  const when = formatWhen(data.startTime, data.endTime);
  const priceLabel = formatPrice(data.price, data.currency);
  const shortOrder = data.orderId ? data.orderId.replace(/-/g, '').slice(0, 8).toUpperCase() : null;

  return (
    <div id={rootId} className={styles.printRoot} data-ticket-print>
      <article className={styles.sheet}>
        <header className={styles.brand}>
          Электронный билет · {BRAND_NAME}
        </header>
        <h1 className={styles.eventName}>{data.eventName}</h1>
        {when && <p className={styles.when}>{when}</p>}
        {data.address && <p className={styles.address}>{data.address}</p>}

        <div className={styles.metaRow}>
          {data.ticketTypeName && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Тип</span>
              <span className={styles.metaValue}>{data.ticketTypeName}</span>
            </div>
          )}
          {priceLabel && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Цена</span>
              <span className={styles.metaValue}>{priceLabel}</span>
            </div>
          )}
          {shortOrder && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Заказ</span>
              <span className={styles.metaValue}>{shortOrder}</span>
            </div>
          )}
        </div>

        <div className={styles.qrWrap}>
          <QrCodeImage
            value={data.code}
            size={200}
            alt={`QR билета ${data.code}`}
          />
        </div>
        <p className={styles.code}>{data.code}</p>
        <p className={styles.hint}>Покажите QR или код на входе</p>
      </article>
    </div>
  );
}
