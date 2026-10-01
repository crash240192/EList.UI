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
  hidden?: boolean;
  account?: IConversationAccount | null;
  personInfo?: IConversationPersonInfo | null;
  likesCount?: number;
  dislikesCount?: number;
  /** 'like' | 'dislike' | null */
  currentUserVote?: MessageVoteValue | null;
  /** Вложения (file id из filestorage), до 10 */
  fileIds?: string[];
}

export type MessageVoteValue = 'like' | 'dislike';

export interface IMessageVoteResult {
  messageId: string;
  likesCount: number;
  dislikesCount: number;
  currentUserVote: MessageVoteValue | null;
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
  /** Вложения (file id). Текст может быть пустым, если есть файлы. */
  fileIds?: string[];
}

/** Узел пути root → target для deep-link из уведомлений */
export interface IMessagePathNode {
  messageId: string;
  parentId: string | null;
  /** Страница среди сиблингов под parentId (для корня — среди корней) */
  pageIndex: number;
}

/** Позиция сообщения в дереве обсуждения */
export interface IMessageLocation {
  messageId: string;
  conversationId: string;
  eventId: string | null;
  rootId: string;
  parentId: string | null;
  path: IMessagePathNode[];
  ancestorIds: string[];
  rootPageIndex: number;
  siblingPageIndex: number;
}
