// pages/create-event/CreateEventHostChooser.tsx
// Выбор: создать событие от своего имени или от верифицированной организации

import { useEffect, useState } from 'react';
import {
  OrganizationVerificationStatus,
  fetchMyOrganizations,
  getOrganizationAvatar,
  type OrganizationResponse,
} from '@/entities/organization';
import { getOrFetchAccountId } from '@/entities/user/api';
import { fetchFullProfile } from '@/entities/user/profileApi';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { AuthImage } from '@/shared/ui/AuthImage/AuthImage';
import { Button } from '@/shared/ui/Button';
import { HeroBackButton } from '@/shared/ui/HeroBackButton';
import { useSafeBack } from '@/shared/lib/useSafeBack';
import styles from './CreateEventHostChooser.module.css';

export type CreateEventHost =
  | { kind: 'user' }
  | {
      kind: 'organization';
      organizationId: string;
      organizationName: string;
      canSellTickets: boolean;
    };

interface Props {
  onContinue: (host: CreateEventHost) => void;
}

interface OrgOption {
  org: OrganizationResponse;
  logoId: string | null;
}

export function CreateEventHostChooser({ onContinue }: Props) {
  const goBack = useSafeBack('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selected, setSelected] = useState<CreateEventHost>({ kind: 'user' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const id = await getOrFetchAccountId();
        const [profile, myOrgs] = await Promise.all([
          fetchFullProfile(null),
          fetchMyOrganizations(),
        ]);
        if (cancelled) return;

        const verified = myOrgs.filter(
          o => o.active !== false
            && o.verificationStatus === OrganizationVerificationStatus.Verified,
        );
        const withLogos = await Promise.all(
          verified.map(async org => ({
            org,
            logoId: await getOrganizationAvatar(org.id).catch(() => null),
          })),
        );
        if (cancelled) return;

        setAccountId(id);
        setLogin(profile.account.login);
        setAvatarId(profile.account.avatarId ?? null);
        const name = [profile.person?.firstName, profile.person?.lastName]
          .filter(Boolean)
          .join(' ');
        setFullName(name);
        setOrgs(withLogos);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const initials = (fullName || login || '?').slice(0, 2).toUpperCase();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.header}>
          <HeroBackButton onClick={goBack} />
          <h1 className={styles.title}>Новое событие</h1>
        </div>

        {loading ? (
          <div className={styles.loader}>Загрузка...</div>
        ) : (
          <div className={styles.body}>
            {error && <div className={styles.error}>{error}</div>}

            <section className={styles.section}>
              <div className={styles.sectionLabel}>От чьего лица</div>
              <p className={styles.sectionHint}>
                Выберите, от имени кого будет опубликовано мероприятие
              </p>
              <div className={styles.hostGrid}>
                <button
                  type="button"
                  className={`${styles.hostCard} ${selected.kind === 'user' ? styles.hostCardSelected : ''}`}
                  onClick={() => setSelected({ kind: 'user' })}
                >
                  <div className={styles.hostAvatar}>
                    {accountId ? (
                      <UserAvatar
                        accountId={accountId}
                        avatarId={avatarId}
                        initials={initials}
                        size={40}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className={styles.hostInfo}>
                    <span className={styles.hostName}>
                      {fullName || (login ? `@${login}` : 'Я')}
                    </span>
                    <span className={styles.hostMeta}>Личный профиль</span>
                  </div>
                  <span className={styles.checkMark} aria-hidden>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </button>

                {orgs.map(({ org, logoId }) => {
                  const orgInitials = org.name.slice(0, 2).toUpperCase() || 'ОР';
                  const isSelected =
                    selected.kind === 'organization'
                    && selected.organizationId === org.id;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      className={`${styles.hostCard} ${isSelected ? styles.hostCardSelected : ''}`}
                      onClick={() => setSelected({
                        kind: 'organization',
                        organizationId: org.id,
                        organizationName: org.name,
                        canSellTickets: Boolean(org.canSellTickets),
                      })}
                    >
                      <div className={`${styles.hostAvatar} ${styles.hostAvatarSquare}`}>
                        {logoId ? (
                          <AuthImage fileId={logoId} alt="" className={styles.hostAvatarImg} />
                        ) : (
                          <span>{orgInitials}</span>
                        )}
                      </div>
                      <div className={styles.hostInfo}>
                        <span className={styles.hostName}>{org.name}</span>
                        <span className={styles.hostMeta}>
                          {org.canSellTickets
                            ? 'Организация · билеты доступны'
                            : 'Организация · верифицирована'}
                        </span>
                      </div>
                      <span className={styles.checkMark} aria-hidden>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionLabel}>Шаблон</div>
              <p className={styles.sectionHint}>
                Сохранённые шаблоны появятся здесь позже
              </p>
              <div className={styles.templateGrid}>
                <div className={styles.templateCard} aria-disabled>
                  <div className={styles.templateIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  </div>
                  <div className={styles.templateName}>С нуля</div>
                  <div className={styles.templateMeta}>Пустая форма без предзаполнения</div>
                </div>
                <div className={styles.templateCard} aria-disabled>
                  <div className={styles.templateIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  </div>
                  <div className={styles.templateName}>Мои шаблоны</div>
                  <div className={styles.templateMeta}>Скоро — сохранение и повторное использование настроек</div>
                </div>
              </div>
            </section>

            <div className={styles.footer}>
              <Button
                onClick={() => onContinue(selected)}
                disabled={!!error}
              >
                Продолжить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
