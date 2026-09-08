// entities/order/api.ts

import { apiClient } from '@/shared/api/client';
import type {
  ICompletePaymentRequest,
  ICreateOrderRequest,
  ICreateOrderResponse,
  IOrder,
  ITicket,
  OrderStatus,
  TicketStatus,
} from './types';

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTicket(raw: Record<string, unknown>): ITicket {
  return {
    id: asStr(raw.id ?? raw.Id),
    orderId: asStr(raw.orderId ?? raw.OrderId),
    eventId: asStr(raw.eventId ?? raw.EventId),
    holderAccountId: asStr(raw.holderAccountId ?? raw.HolderAccountId),
    status: asStr(raw.status ?? raw.Status) as TicketStatus,
    code: asStr(raw.code ?? raw.Code),
    issuedAt: raw.issuedAt != null || raw.IssuedAt != null
      ? asStr(raw.issuedAt ?? raw.IssuedAt)
      : null,
  };
}

function normalizeOrder(raw: Record<string, unknown>): IOrder {
  const ticketsRaw = raw.tickets ?? raw.Tickets;
  const tickets = Array.isArray(ticketsRaw)
    ? ticketsRaw
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .map(normalizeTicket)
    : [];

  return {
    id: asStr(raw.id ?? raw.Id),
    eventId: asStr(raw.eventId ?? raw.EventId),
    buyerAccountId: asStr(raw.buyerAccountId ?? raw.BuyerAccountId),
    sellerOrganizationId: (() => {
      const v = raw.sellerOrganizationId ?? raw.SellerOrganizationId;
      return v == null || v === '' ? null : String(v);
    })(),
    quantity: asNum(raw.quantity ?? raw.Quantity),
    amountTotal: asNum(raw.amountTotal ?? raw.AmountTotal),
    amountSeller: asNum(raw.amountSeller ?? raw.AmountSeller),
    amountCommission: asNum(raw.amountCommission ?? raw.AmountCommission),
    currency: asStr(raw.currency ?? raw.Currency) || 'RUB',
    status: asStr(raw.status ?? raw.Status) as OrderStatus,
    createDate: asStr(raw.createDate ?? raw.CreateDate),
    paidAt: raw.paidAt != null || raw.PaidAt != null
      ? asStr(raw.paidAt ?? raw.PaidAt)
      : null,
    tickets,
  };
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** POST /api/orders */
export async function createOrder(
  payload: Omit<ICreateOrderRequest, 'idempotencyKey'> & { idempotencyKey?: string },
): Promise<ICreateOrderResponse> {
  const body: ICreateOrderRequest = {
    eventId: payload.eventId,
    quantity: payload.quantity,
    idempotencyKey: payload.idempotencyKey ?? newIdempotencyKey(),
  };
  const r = await apiClient.post<Record<string, unknown>>('/api/orders', body);
  const raw = (r.result ?? {}) as Record<string, unknown>;
  const orderRaw = (raw.order ?? raw.Order ?? {}) as Record<string, unknown>;
  return {
    order: normalizeOrder(orderRaw),
    confirmationUrl: (() => {
      const v = raw.confirmationUrl ?? raw.ConfirmationUrl;
      return v == null || v === '' ? null : String(v);
    })(),
    providerPaymentId: (() => {
      const v = raw.providerPaymentId ?? raw.ProviderPaymentId;
      return v == null || v === '' ? null : String(v);
    })(),
    paidImmediately: Boolean(raw.paidImmediately ?? raw.PaidImmediately),
  };
}

/** POST /api/orders/payments/complete */
export async function completePayment(
  payload: ICompletePaymentRequest,
): Promise<IOrder> {
  const r = await apiClient.post<Record<string, unknown>>(
    '/api/orders/payments/complete',
    payload,
  );
  return normalizeOrder((r.result ?? {}) as Record<string, unknown>);
}

/** GET /api/orders/my */
export async function fetchMyOrders(): Promise<IOrder[]> {
  const r = await apiClient.get<Record<string, unknown>[]>('/api/orders/my');
  return (r.result ?? []).map(row => normalizeOrder(row as Record<string, unknown>));
}

/** GET /api/orders/{orderId} */
export async function fetchOrderById(orderId: string): Promise<IOrder | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(`/api/orders/${orderId}`);
    return r.result ? normalizeOrder(r.result as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** GET /api/orders/tickets/my?eventId= */
export async function fetchMyTickets(eventId?: string): Promise<ITicket[]> {
  const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
  const r = await apiClient.get<Record<string, unknown>[]>(`/api/orders/tickets/my${qs}`);
  return (r.result ?? []).map(row => normalizeTicket(row as Record<string, unknown>));
}

/** GET /api/orders/tickets/byCode/{code} */
export async function fetchTicketByCode(code: string): Promise<ITicket | null> {
  try {
    const r = await apiClient.get<Record<string, unknown>>(
      `/api/orders/tickets/byCode/${encodeURIComponent(code)}`,
    );
    return r.result ? normalizeTicket(r.result as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
