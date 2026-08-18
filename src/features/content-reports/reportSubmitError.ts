import { ApiError } from '@/shared/api/client';
import { ApiErrorCode } from '@/shared/api/errorCodes';

const NOT_FOUND_CODES = new Set<number>([
  ApiErrorCode.AccountNotFound,
  ApiErrorCode.EventNotFound,
  ApiErrorCode.OrganizationNotFound,
  ApiErrorCode.MessageNotFound,
  ApiErrorCode.FileNotFound,
]);

export function isAlreadyReportedError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.code === ApiErrorCode.ContentReportAlreadyExists) return true;
  const blob = `${e.message} ${e.serverMessage ?? ''}`.toLowerCase();
  return (
    blob.includes('contentreportalreadyexists')
    || blob.includes('already exists')
    || blob.includes('уже есть активн')
    || blob.includes('уже жаловались')
  );
}

export function contentReportActionMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === ApiErrorCode.ContentReportNotInReview) {
      return e.serverMessage || 'Сначала возьмите жалобу в работу';
    }
    if (e.code === ApiErrorCode.ContentReportPenaltyActive) {
      return e.serverMessage || 'Действует ограничение модерации';
    }
    if (e.code === ApiErrorCode.ContentReportRestoreNotModerationCancel) {
      return e.serverMessage || 'Это мероприятие отменил организатор';
    }
    if (e.code === ApiErrorCode.ContentReportPenaltyNotFound) {
      return e.serverMessage || 'Ограничение не найдено';
    }
    return e.serverMessage || e.message || 'Не удалось выполнить действие';
  }
  return e instanceof Error ? e.message : 'Не удалось выполнить действие';
}

export function contentReportSubmitMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === ApiErrorCode.AccessError) return e.serverMessage || 'Войдите в аккаунт';
    if (e.code === ApiErrorCode.InvalidValue) return e.serverMessage || 'Нельзя отправить эту жалобу';
    if (e.code === ApiErrorCode.ContentReportReasonNotFound) {
      return e.serverMessage || 'Выберите другую причину';
    }
    if (e.code === ApiErrorCode.ContentReportPenaltyActive) {
      return e.serverMessage || 'Действует ограничение модерации';
    }
    if (isAlreadyReportedError(e)) return e.serverMessage || 'Вы уже жаловались на это';
    if (NOT_FOUND_CODES.has(e.code)) return e.serverMessage || 'Объект больше недоступен';
    return e.serverMessage || e.message || 'Не удалось отправить жалобу';
  }
  return e instanceof Error ? e.message : 'Не удалось отправить жалобу';
}
