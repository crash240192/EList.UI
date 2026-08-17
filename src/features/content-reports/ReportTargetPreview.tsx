import { Link } from 'react-router-dom';
import {
  REPORT_PHOTO_KIND_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  ReportTargetType,
  parseTargetSnapshot,
  snapshotFileId,
  snapshotPreviewText,
  type IContentReport,
} from '@/entities/contentReport';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './ReportTargetPreview.module.css';

interface ReportTargetPreviewProps {
  report: IContentReport;
  compact?: boolean;
}

function targetHref(report: IContentReport): string | null {
  const snap = parseTargetSnapshot(report.targetSnapshot);
  if (report.targetType === ReportTargetType.Event && report.targetId) {
    return `/event/${report.targetId}`;
  }
  if (report.eventId) return `/event/${report.eventId}`;
  if (report.targetType === ReportTargetType.Account) {
    return `/user/${report.targetId}`;
  }
  if (report.targetType === ReportTargetType.Organization) {
    return `/organization/${report.targetId}`;
  }
  const accountId = report.reportedAccountId || snap?.accountId;
  if (accountId && (snap?.kind === 'account_avatar' || snap?.kind === 'account_album')) {
    return `/user/${accountId}`;
  }
  const organizationId = report.organizationId || snap?.organizationId;
  if (organizationId) {
    return `/organization/${organizationId}`;
  }
  return null;
}

export function ReportTargetPreview({ report, compact = false }: ReportTargetPreviewProps) {
  const snap = parseTargetSnapshot(report.targetSnapshot);
  const kind = snap?.kind ?? '';
  const fileId = snapshotFileId(report);
  const preview = snapshotPreviewText(report);
  const href = targetHref(report);
  const typeLabel = REPORT_TARGET_TYPE_LABELS[report.targetType] || report.targetType;
  const kindLabel = kind ? (REPORT_PHOTO_KIND_LABELS[kind] || kind) : null;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {fileId && (
        <div className={styles.thumb}>
          <AuthImage
            fileId={fileId}
            alt={kindLabel || 'Фото'}
            className={styles.thumbImg}
            fallback={<div className={styles.thumbFallback} />}
          />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.typeRow}>
          <span>{typeLabel}</span>
          {kindLabel && <span className={styles.kind}>{kindLabel}</span>}
        </div>
        {preview ? (
          <p className={styles.text}>{preview}</p>
        ) : !fileId ? (
          <p className={styles.muted}>Нет превью</p>
        ) : null}
        {report.eventName && report.targetType !== ReportTargetType.Event && (
          <p className={styles.muted}>{report.eventName}</p>
        )}
        {!compact && href && (
          <Link className={styles.link} to={href} onClick={e => e.stopPropagation()}>
            Открыть объект
          </Link>
        )}
      </div>
    </div>
  );
}
