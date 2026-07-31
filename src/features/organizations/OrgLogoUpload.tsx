// features/organizations/OrgLogoUpload.tsx

import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/shared/api/fileStorageClient';
import { setOrganizationAvatar } from '@/entities/organization';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import styles from './OrganizationsSettingsPanel.module.css';

interface OrgLogoUploadProps {
  organizationId: string;
  fileId?: string | null;
  initials: string;
  onChanged?: (fileId: string) => void;
}

export function OrgLogoUpload({
  organizationId,
  fileId: initialFileId,
  initials,
  onChanged,
}: OrgLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState<string | null>(initialFileId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFileId(initialFileId ?? null);
  }, [initialFileId]);

  const displayFileId = fileId ?? initialFileId ?? null;

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file);
      await setOrganizationAvatar(organizationId, uploaded.id);
      setFileId(uploaded.id);
      onChanged?.(uploaded.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить логотип');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.logoUpload}>
      <button
        type="button"
        className={styles.logoBtn}
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        aria-label="Загрузить логотип"
      >
        {displayFileId ? (
          <AuthImage fileId={displayFileId} alt="" className={styles.logoImg} />
        ) : (
          <span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>
        )}
        {loading && <span className={styles.logoSpinner} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      {error && <p className={styles.inlineErr}>{error}</p>}
    </div>
  );
}
