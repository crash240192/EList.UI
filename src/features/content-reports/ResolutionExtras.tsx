// features/content-reports/ResolutionExtras.tsx

import { Select } from '@/shared/ui/Select/Select';
import {
  MODERATION_PENALTY_TYPE_LABELS,
  ModerationPenaltyType,
  PENALTY_DURATION_PRESETS,
  ReportResolutionAction,
  needsDurationHours,
  type ModerationPenaltyTypeValue,
  type ReportResolutionActionValue,
} from '@/entities/contentReport';
import styles from './ResolutionExtras.module.css';

interface ResolutionExtrasProps {
  action: ReportResolutionActionValue | '';
  penaltyTypes: readonly ModerationPenaltyTypeValue[];
  penaltyType: string;
  onPenaltyTypeChange: (value: string) => void;
  durationPreset: string;
  onDurationPresetChange: (value: string) => void;
  customHours: string;
  onCustomHoursChange: (value: string) => void;
  disabled?: boolean;
}

export function durationHoursFromFields(
  action: ReportResolutionActionValue | '',
  durationPreset: string,
  customHours: string,
): number | null {
  if (!action || !needsDurationHours(action)) return null;
  if (durationPreset === '') return null;
  if (durationPreset === 'custom') {
    const n = Number(customHours);
    if (!Number.isFinite(n)) return null;
    return Math.min(43800, Math.max(1, Math.round(n)));
  }
  const n = Number(durationPreset);
  return Number.isFinite(n) ? n : null;
}

export function durationPresetLabel(durationPreset: string, customHours: string): string {
  if (durationPreset === '') return 'бессрочно';
  if (durationPreset === 'custom') {
    const n = Number(customHours);
    if (!Number.isFinite(n)) return 'свой срок';
    return `${Math.min(43800, Math.max(1, Math.round(n)))} ч.`;
  }
  const found = PENALTY_DURATION_PRESETS.find(item => String(item.hours) === durationPreset);
  return found?.label ?? `${durationPreset} ч.`;
}

export function ResolutionExtras({
  action,
  penaltyTypes,
  penaltyType,
  onPenaltyTypeChange,
  durationPreset,
  onDurationPresetChange,
  customHours,
  onCustomHoursChange,
  disabled,
}: ResolutionExtrasProps) {
  const showPenaltyType = action === ReportResolutionAction.ApplyPenalty;
  const showDuration = !!action && needsDurationHours(action);

  if (!showPenaltyType && !showDuration) return null;

  return (
    <>
      {showPenaltyType && (
        <div className={styles.field}>
          <span className={styles.label}>Тип ограничения</span>
          <Select
            value={penaltyType}
            onChange={onPenaltyTypeChange}
            options={penaltyTypes.map(type => ({
              value: type,
              label: MODERATION_PENALTY_TYPE_LABELS[type],
            }))}
            disabled={disabled}
          />
        </div>
      )}
      {showDuration && (
        <div className={styles.field}>
          <span className={styles.label}>Срок</span>
          <Select
            value={durationPreset}
            onChange={onDurationPresetChange}
            options={[
              ...PENALTY_DURATION_PRESETS.map(item => ({
                value: String(item.hours),
                label: item.label,
              })),
              { value: '', label: 'Бессрочно' },
              { value: 'custom', label: 'Свой срок (часы)' },
            ]}
            disabled={disabled}
          />
          {durationPreset === 'custom' && (
            <input
              className={styles.input}
              type="number"
              min={1}
              max={43800}
              value={customHours}
              onChange={e => onCustomHoursChange(e.target.value)}
              disabled={disabled}
              placeholder="Часы, от 1 до 43800"
            />
          )}
        </div>
      )}
    </>
  );
}

export function defaultPenaltyType(
  types: readonly ModerationPenaltyTypeValue[],
): string {
  return types[0] ?? ModerationPenaltyType.BanFromEvent;
}
