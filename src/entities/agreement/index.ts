export {
  getAnonymousAgeAgreement,
  agreeAnonymousAge,
  checkUserAgreement,
  agreeDocument,
  checkOrganizationAgreement,
  agreeOrganizationDocument,
  fetchLastDocument,
  fetchLastDocuments,
  addAgreementDocument,
} from './api';

export {
  DocumentType,
  DOCUMENT_TYPE_NAMES,
  DOCUMENT_TYPE_LABELS,
  parseDocumentType,
  documentRequiresConsent,
  type DocumentTypeValue,
  type IAgreementDocument,
  type IDocumentRequest,
} from './types';
