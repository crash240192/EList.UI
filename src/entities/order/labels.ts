// entities/order/labels.ts

import type { OrderStatus, TicketStatus } from './types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  Pending: 'Ожидает оплаты',
  Authorized: 'Авторизован',
  Paid: 'Оплачен',
  Canceled: 'Отменён',
  Refunded: 'Возвращён',
  PartiallyRefunded: 'Частичный возврат',
  Failed: 'Ошибка оплаты',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  Issued: 'Активен',
  Used: 'Использован',
  Refunded: 'Возвращён',
  Void: 'Аннулирован',
};

export function formatMoney(amount: number, currency = 'RUB'): string {
  const suffix = currency === 'RUB' || currency === '₽' ? '₽' : currency;
  return `${amount.toLocaleString('ru-RU')} ${suffix}`;
}
