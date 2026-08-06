// pages/create-event/CreateEventHostChooser.tsx
// Выбор: создать событие от своего имени или от верифицированной организации + шаблон

import { useEffect, useState } from 'react';
import {
  deleteEventTemplate,
  searchEventTemplates,
  type IEventTemplate,
} from '@/entities/event';
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
import { apiIsoToLocalParts, formatLocalDateLongRu } from '@/shared/lib/datetime';
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
  onContinue: (host: CreateEventHost, template: IEventTemplate | null) => void;
}

interface OrgOption {
  org: OrganizationResponse;
  logoId: string | null;
}

interface TemplateCardInfo {
  eventName: string | null;
  address: string | null;
  when: string | null;
  costLabel: string;
  privacyLabel: string;
  ageLabel: string | null;
  inviteLabel: string | null;
  listLabel: string | null;
  ticketsLabel: string | null;
  coverImageId: string | null;
  coverUrl: string | null;
}

function buildTemplateCardInfo(t: IEventTemplate): TemplateCardInfo {
  const body = t.templateBody;
  const ev = body?.event;
  const params = body?.eventParameters;
  const blackIds = [
    ...(body?.blackList ?? []),
    ...(body?.BlackList ?? []),
  ];
  const whiteIds = [
    ...(body?.whiteList ?? []),
    ...(body?.WhiteList ?? []),
  ];
  const inviteIds = [
    ...(body?.inviteUsers ?? []),
    ...(body?.InviteUsers ?? []),
  ];
  const inviteAll = Boolean(body?.inviteAllSubscribers ?? body?.InviteAllSubscribers);
  const isPrivate = Boolean(params?.private);
  const cost = Number(params?.cost ?? 0);
  const age = params?.ageLimit;

  let when: string | null = null;
  if (ev?.startTime) {
    const parts = apiIsoToLocalParts(String(ev.startTime));
    if (parts.date) {
      when = `${formatLocalDateLongRu(parts.date)}${parts.time ? ` · ${parts.time}` : ''}`;
    }
  }

  const listCount = isPrivate ? whiteIds.length : blackIds.length;
  const listLabel = listCount > 0
    ? (isPrivate ? `Белый список: ${listCount}` : `Чёрный список: ${listCount}`)
    : null;

  let inviteLabel: string | null = null;
  if (inviteAll) inviteLabel = 'Пригласить всех подписчиков';
  else if (inviteIds.length > 0) inviteLabel = `Приглашений: ${inviteIds.length}`;

  return {
    eventName: ev?.name?.trim() || null,
    address: ev?.address?.trim() || null,
    when,
    costLabel: cost > 0 ? `${cost.toLocaleString('ru-RU')} ₽` : 'Бесплатно',
    privacyLabel: isPrivate ? 'Закрытое' : 'Открытое',
    ageLabel: age == null || Number.isNaN(Number(age)) ? null : `${Math.trunc(Number(age))}+`,
    inviteLabel,
    listLabel,
    ticketsLabel: params?.ticketsEnabled ? 'Билеты' : null,
    coverImageId: ev?.coverImageId ? String(ev.coverImageId) : null,
    coverUrl: ev?.coverUrl ? String(ev.coverUrl) : null,
  };
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
  const [templates, setTemplates] = useState<IEventTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Шаблоны для выбранного хоста
  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    setSelectedTemplateId(null);
    setDeleteConfirmId(null);
    setActionError(null);
    const orgId = selected.kind === 'organization' ? selected.organizationId : undefined;
    searchEventTemplates(orgId ? { organizationId: orgId } : {})
      .then(list => {
        if (cancelled) return;
        setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => { cancelled = true; };
  }, [selected]);

  const initials = (fullName || login || '?').slice(0, 2).toUpperCase();

  const handleContinue = () => {
    const template = selectedTemplateId
      ? templates.find(t => t.id === selectedTemplateId) ?? null
      : null;
    onContinue(selected, template);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteEventTemplate(deleteConfirmId);
      setTemplates(prev => prev.filter(t => t.id !== deleteConfirmId));
      if (selectedTemplateId === deleteConfirmId) setSelectedTemplateId(null);
      setDeleteConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось удалить шаблон');
    } finally {
      setDeleting(false);
    }
  };

  const deleteTarget = deleteConfirmId
    ? templates.find(t => t.id === deleteConfirmId)
    : null;

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
            {actionError && <div className={styles.error}>{actionError}</div>}

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
                          <AuthImage
                            fileId={logoId}
                            alt=""
                            className={styles.hostAvatarImg}
                            fallback={<span>{orgInitials}</span>}
                          />
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
                {selected.kind === 'organization'
                  ? 'Шаблоны этой организации или пустая форма'
                  : 'Ваши шаблоны или пустая форма'}
              </p>
              <div className={styles.templateGrid}>
                <button
                  type="button"
                  className={`${styles.templateCard} ${styles.templateCardActive} ${selectedTemplateId === null ? styles.templateCardSelected : ''}`}
                  onClick={() => setSelectedTemplateId(null)}
                >
                  <div className={styles.templateBlankVisual} aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <div className={styles.templateBody}>
                    <div className={styles.templateName}>С нуля</div>
                    <div className={styles.templateEventName}>Пустая форма</div>
                    <div className={styles.templateMeta}>Без предзаполнения полей</div>
                  </div>
                </button>

                {templatesLoading && (
                  <div className={styles.templateCardMuted}>
                    <div className={styles.templateMeta}>Загрузка шаблонов...</div>
                  </div>
                )}

                {!templatesLoading && templates.map(t => {
                  const info = buildTemplateCardInfo(t);
                  const chips = [
                    info.privacyLabel,
                    info.costLabel,
                    info.ageLabel,
                    info.ticketsLabel,
                    info.inviteLabel,
                    info.listLabel,
                  ].filter(Boolean) as string[];

                  return (
                    <div
                      key={t.id}
                      className={`${styles.templateCard} ${styles.templateCardActive} ${selectedTemplateId === t.id ? styles.templateCardSelected : ''}`}
                    >
                      <button
                        type="button"
                        className={styles.templateSelectArea}
                        onClick={() => setSelectedTemplateId(t.id)}
                      >
                        <div className={styles.templateCover}>
                          {info.coverImageId ? (
                            <AuthImage
                              fileId={info.coverImageId}
                              alt=""
                              className={styles.templateCoverImg}
                              fallback={<div className={styles.templateCoverFallback} />}
                            />
                          ) : info.coverUrl ? (
                            <img src={info.coverUrl} alt="" className={styles.templateCoverImg} />
                          ) : (
                            <div className={styles.templateCoverFallback}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className={styles.templateBody}>
                          <div className={styles.templateName}>{t.name}</div>
                          {info.eventName && (
                            <div className={styles.templateEventName}>{info.eventName}</div>
                          )}
                          {info.address && (
                            <div className={styles.templateMeta}>{info.address}</div>
                          )}
                          {info.when && (
                            <div className={styles.templateMeta}>{info.when}</div>
                          )}
                          {!info.eventName && !info.address && !info.when && (
                            <div className={styles.templateMeta}>Сохранённые настройки</div>
                          )}
                          {chips.length > 0 && (
                            <div className={styles.templateChips}>
                              {chips.map(chip => (
                                <span key={chip} className={styles.templateChip}>{chip}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        className={styles.templateDeleteBtn}
                        title="Удалить шаблон"
                        aria-label={`Удалить шаблон «${t.name}»`}
                        onClick={e => {
                          e.stopPropagation();
                          setActionError(null);
                          setDeleteConfirmId(t.id);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {!templatesLoading && templates.length === 0 && (
                  <div className={styles.templateCardMuted}>
                    <div className={styles.templateMeta}>
                      Шаблонов пока нет — сохраните форму как шаблон после заполнения
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className={styles.footer}>
              <Button
                onClick={handleContinue}
                disabled={!!error}
              >
                Продолжить
              </Button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className={styles.confirmOverlay} onClick={() => !deleting && setDeleteConfirmId(null)}>
          <div
            className={styles.confirmDialog}
            role="dialog"
            aria-modal
            aria-label="Удаление шаблона"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.confirmTitle}>Удалить шаблон?</div>
            <p className={styles.confirmHint}>
              Шаблон «{deleteTarget?.name ?? 'без названия'}» будет удалён безвозвратно.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                disabled={deleting}
                onClick={() => setDeleteConfirmId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmDelete}
                disabled={deleting}
                onClick={() => { void handleDeleteTemplate(); }}
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
