// entities/order/types.ts

export type OrderStatus =
  | 'Pending'
  | 'Authorized'
  | 'Paid'
  | 'Canceled'
  | 'Refunded'
  | 'PartiallyRefunded'
  | 'Failed';

export type TicketStatus = 'Issued' | 'Used' | 'Refunded' | 'Void';

export interface ITicket {
  id: string;
  orderId: string;
  eventId: string;
  holderAccountId: string;
  status: TicketStatus;
  code: string;
  issuedAt: string | null;
}

export interface IOrder {
  id: string;
  eventId: string;
  buyerAccountId: string;
  sellerOrganizationId: string | null;
  quantity: number;
  amountTotal: number;
  amountSeller: number;
  amountCommission: number;
  currency: string;
  status: OrderStatus;
  createDate: string;
  paidAt: string | null;
  tickets: ITicket[];
}

export interface ICreateOrderRequest {
  eventId: string;
  quantity: number;
  idempotencyKey: string;
}

export interface ICreateOrderResponse {
  order: IOrder;
  confirmationUrl: string | null;
  providerPaymentId: string | null;
  paidImmediately: boolean;
}

export interface ICompletePaymentRequest {
  orderId?: string;
  providerPaymentId?: string;
}

export interface ITransferTicketRequest {
  ticketId?: string;
  code?: string;
  newHolderAccountId: string;
}

export interface ICreateRefundRequest {
  orderId: string;
  ticketIds?: string[];
  reason?: string;
}

export interface ITicketCheckInRequest {
  eventId: string;
  code: string;
}
