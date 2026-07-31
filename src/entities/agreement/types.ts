// entities/agreement/types.ts

/** Тип документа пользовательского соглашения (C# DocumentType) */
export const DocumentType = {
  Policy: 0,
  Consent: 1,
  Agreement: 2,
  /** Оферта организатора — принятие перед созданием организации */
  OrganizerAgreement: 3,
} as const;

export type DocumentTypeValue = (typeof DocumentType)[keyof typeof DocumentType];

export interface IAgreementDocument {
  id: string;
  header: string;
  text: string;
  hash: string;
  type: DocumentTypeValue;
  version: string;
  creationDate: string;
}

export interface IDocumentRequest {
  header: string;
  text: string;
  type: DocumentTypeValue;
  version: string;
}
