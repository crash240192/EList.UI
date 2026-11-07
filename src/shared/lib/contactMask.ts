// shared/lib/contactMask.ts
// Валидация и утилиты контактных масок (реэкспорт)

export {
  isRegexMask,
  resolveContactInputKind,
  resolveContactMaskTemplate,
  validateContactValue,
  canonicalizeContactValue,
  getMaskInputMode,
  buildContactMaskSegments,
  composeContactValue,
  extractRawFromValue,
  processPhoneRaw,
  processEmailRaw,
  formatPhoneMasked,
  phoneDigitsFromValue,
  PHONE_RU_INPUT_TEMPLATE,
} from './contactMaskFormat';

export type { MaskSegment, ContactInputKind } from './contactMaskFormat';
