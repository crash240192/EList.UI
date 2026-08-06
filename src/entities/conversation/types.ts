export interface IConversation {
  id: string;
  name: string;
  eventId?: string | null;
  /** Видно только участникам мероприятия */
  participantsOnlyVisible: boolean;
  /** Участники могут только читать (без комментариев) */
  participantsReadonly: boolean;
  createDate: string;
  updateDate: string;
}

export interface IConversationAccount {
  id: string;
  login?: string | null;
  avatarId?: string | null;
}

export interface IConversationPersonInfo {
  firstName?: string | null;
  lastName?: string | null;
}

export interface IMessage {
  id: string;
  conversationId: string;
  messageText: string;
  replied: boolean;
  accountId?: string | null;
  organizationId?: string | null;
  replyTo?: string | null;
  createDate: string;
  updateDate: string;
  account?: IConversationAccount | null;
  personInfo?: IConversationPersonInfo | null;
}

export interface IConversationRequest {
  id?: string | null;
  name: string;
  eventId?: string | null;
  participantsOnlyVisible?: boolean;
  participantsReadonly?: boolean;
}

export interface IMessageRequest {
  id?: string | null;
  conversationId: string;
  messageText: string;
  accountId?: string | null;
  organizationId?: string | null;
  replyTo?: string | null;
}
