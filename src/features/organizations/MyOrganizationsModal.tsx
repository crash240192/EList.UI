// features/organizations/MyOrganizationsModal.tsx
// Список организаций текущего пользователя (из меню аватара)

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  formatVerificationStatus,
  getOrganizationAvatar,
  type OrganizationResponse,
} from '@/entities/organization';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { useModalBackButton } from '@/shared/lib/useModalBackButton';
import styles from './MyOrganizationsModal.module.css';

interface Props {
  organizations: OrganizationResponse[];
  onClose: () => void;
}

export function MyOrganizationsModal({ organizations, onClose }: Props) {
  const navigate = useNavigate();
  const [logoById, setLogoById] = useState<Record<string, string | null>>({});

  useModalBackButton(onClose);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      organizations.map(async org => {
        try {
          const logo = await getOrganizationAvatar(org.id);
          return [org.id, logo] as const;
        } catch {
          return [org.id, null] as const;
        }
      }),
    ).then(entries => {
      if (!cancelled) setLogoById(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [organizations]);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-modal aria-labelledby="my-orgs-title">
        <div className={styles.header}>
          <h3 id="my-orgs-title" className={styles.title}>Мои организации</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {organizations.length === 0 ? (
            <p className={styles.empty}>Организаций пока нет</p>
          ) : (
            organizations.map(org => {
              const logoId = logoById[org.id];
              const initials = org.name.slice(0, 2).toUpperCase() || 'ОР';
              return (
                <button
                  key={org.id}
                  type="button"
                  className={styles.row}
                  onClick={() => {
                    navigate(`/organization/${org.id}`);
                    onClose();
                  }}
                >
                  <div className={styles.logo} aria-hidden>
                    {logoId ? (
                      <AuthImage
                        fileId={logoId}
                        alt=""
                        className={styles.logoImg}
                        fallback={<span className={styles.initials}>{initials}</span>}
                      />
                    ) : (
                      <span className={styles.initials}>{initials}</span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <span className={styles.name}>{org.name}</span>
                    <span className={styles.meta}>
                      {org.address?.trim()
                        || formatVerificationStatus(org.verificationStatus)
                        || 'Организация'}
                    </span>
                  </div>
                  <svg
                    className={styles.chevron}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
