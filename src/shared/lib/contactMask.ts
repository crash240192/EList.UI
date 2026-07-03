// shared/lib/contactMask.ts
// Валидация и утилиты контактных масок (реэкспорт)

export {
  isRegexMask,
  resolveContactMaskTemplate,
  validateContactValue,
  getMaskInputMode,
  buildContactMaskSegments,
  composeContactValue,
  extractRawFromValue,
  processPhoneRaw,
  processEmailRaw,
} from './contactMaskFormat';

export type { MaskSegment } from './contactMaskFormat';
