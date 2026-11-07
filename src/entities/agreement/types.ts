// entities/agreement/types.ts

/** Тип документа пользовательского соглашения (C# DocumentType) */
export const DocumentType = {
  Policy: 0,
  Consent: 1,
  Agreement: 2,
  /** Договор оферты с организацией — принятие перед созданием организации */
  OrganizationAgreement: 3,
  /** Соглашение на продажу билетов */
  TicketingAgreement: 4,
  /** Согласие на распространение персональных данных */
  DistributionConsent: 5,
} as const;

export type DocumentTypeValue = (typeof DocumentType)[keyof typeof DocumentType];

/** Имена C# enum DocumentType (для ответов API со строковым типом) */
export const DOCUMENT_TYPE_NAMES: Record<DocumentTypeValue, string> = {
  [DocumentType.Policy]: 'Policy',
  [DocumentType.Consent]: 'Consent',
  [DocumentType.Agreement]: 'Agreement',
  [DocumentType.OrganizationAgreement]: 'OrganizationAgreement',
  [DocumentType.TicketingAgreement]: 'TicketingAgreement',
  [DocumentType.DistributionConsent]: 'DistributionConsent',
};

/** Подписи для админки и UI */
export const DOCUMENT_TYPE_LABELS: { value: DocumentTypeValue; label: string }[] = [
  { value: DocumentType.Policy, label: 'Политика обработки ПДн' },
  { value: DocumentType.Consent, label: 'Согласие на обработку ПДн' },
  { value: DocumentType.Agreement, label: 'Пользовательское соглашение' },
  { value: DocumentType.OrganizationAgreement, label: 'Договор оферты с организацией' },
  { value: DocumentType.TicketingAgreement, label: 'Соглашение на продажу билетов' },
  { value: DocumentType.DistributionConsent, label: 'Согласие на распространение ПДн' },
];

/** Документы, без которых сервис блокируется (ReConsentMiddleware) */
export const SERVICE_REQUIRED_DOCUMENT_TYPES: DocumentTypeValue[] = [
  DocumentType.Consent,
  DocumentType.Agreement,
];

/** Приводит type из API (число или имя enum) к DocumentTypeValue */
export function parseDocumentType(raw: unknown): DocumentTypeValue {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw as DocumentTypeValue;
  }
  if (typeof raw === 'string') {
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && raw.trim() !== '') return asNum as DocumentTypeValue;
    const byName = (DocumentType as Record<string, DocumentTypeValue>)[raw];
    if (byName != null) return byName;
  }
  return DocumentType.Policy;
}

/**
 * Нужна ли галочка согласия.
 * Если у документа есть requiresAgreement с API — используем его;
 * иначе fallback: всё кроме Policy.
 */
export function documentRequiresConsent(
  type: DocumentTypeValue,
  requiresAgreement?: boolean | null,
): boolean {
  if (typeof requiresAgreement === 'boolean') return requiresAgreement;
  return type !== DocumentType.Policy;
}

/** Значение по умолчанию для админки при создании новой версии */
export function defaultRequiresAgreement(type: DocumentTypeValue): boolean {
  return type !== DocumentType.Policy;
}

export interface IAgreementDocument {
  id: string;
  header: string;
  text: string;
  hash: string;
  type: DocumentTypeValue;
  version: string;
  creationDate: string;
  /** Требует галочку принятия (из API) */
  requiresAgreement: boolean;
}

export interface IDocumentRequest {
  header: string;
  text: string;
  type: DocumentTypeValue;
  version: string;
  requiresAgreement?: boolean;
}
