// features/organizations/OrganizationsSettingsPanel.tsx
// Список / создание / управление организациями в настройках

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  agreeOrganizationDocument,
  checkOrganizationAgreement,
  fetchLastDocument,
  type DocumentTypeValue,
  type IAgreementDocument,
} from '@/entities/agreement';
import {
  OrganizationLegalForm,
  OrganizationOnboardingStatus,
  OrganizationRole,
  OrganizationVerificationStatus,
  addOrganizationManager,
  createOrganization,
  fetchMyOrganizations,
  fetchOrganizationById,
  fetchOrganizationLegal,
  fetchOrganizationMembers,
  fetchOrganizationPayout,
  formatLegalForm,
  formatOnboardingStatus,
  formatOrganizationRole,
  formatVerificationStatus,
  createOrganizationContact,
  fetchOrganizationContacts,
  getOrganizationAvatar,
  organizationMemberAvatarId,
  organizationMemberDisplayName,
  organizationMemberInitials,
  removeOrganizationMember,
  saveOrganizationLegal,
  saveOrganizationPayout,
  setOrganizationActive,
  setOrganizationMemberActive,
  setOrganizationTicketsEnabled,
  submitOrganizationVerification,
  transferOrganizationOwnership,
  updateOrganization,
  updateOrganizationContact,
  type OrganizationLegalFormValue,
  type OrganizationLegalRequest,
  type OrganizationMemberResponse,
  type OrganizationPayoutRequest,
  type OrganizationRegistryParty,
  type OrganizationResponse,
  type OrganizationRoleValue,
} from '@/entities/organization';
import { getOrFetchAccountId } from '@/entities/user/api';
import type { IContactDataItem, IContactType } from '@/entities/user/profileApi';
import type { IContactRequest } from '@/entities/user/settingsApi';
import { fetchContactTypes } from '@/features/auth/registrationApi';
import {
  ensureOrganizationWallet,
  getWalletByOrganization,
  setWalletTariff,
  type IWallet,
} from '@/entities/user/walletApi';
import { tariffApi, type ITariff } from '@/entities/admin/adminApi';
import { getStoredUserCoords } from '@/features/auth/useUserLocation';
import { AgreementDocumentModal } from '@/features/agreements';
import { OrgAgreementAcceptDialog } from '@/features/agreements';
import { YandexMapPicker } from '@/features/event-map/YandexMapPicker';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { UserAvatar } from '@/entities/user/ui/UserAvatar/UserAvatar';
import { Select } from '@/shared/ui/Select/Select';
import { OrgInnLookupModal } from './OrgInnLookupModal';
import { OrgLogoUpload } from './OrgLogoUpload';
import styles from './OrganizationsSettingsPanel.module.css';

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; id: string };

function formatOrgTariffLabel(t: ITariff): string {
  const days = t.periodDays ?? t.period?.days;
  const price = t.cost === 0 ? 'Бесплатно' : `${t.cost.toLocaleString('ru-RU')} ₽`;
  const period = days != null ? `${days} дн.` : null;
  return [t.name, price, period].filter(Boolean).join(' · ');
}

function statusClass(status: OrganizationResponse['verificationStatus']): string {
  switch (status) {
    case OrganizationVerificationStatus.Verified: return styles.badgeOk;
    case OrganizationVerificationStatus.Pending: return styles.badgeWarn;
    case OrganizationVerificationStatus.Rejected: return styles.badgeErr;
    default: return styles.badgeMute;
  }
}

/** Плашку «Не верифицирована» скрываем, если билеты не подключены */
function shouldShowVerificationBadge(org: OrganizationResponse): boolean {
  if (org.canSellTickets) return true;
  return org.verificationStatus !== OrganizationVerificationStatus.Unverified;
}

/** Снимок юр. полей после автозаполнения из реестра */
interface LegalFormSnapshot {
  legalForm: OrganizationLegalFormValue;
  inn: string;
  ogrn: string;
  kpp: string;
  legalAddress: string;
  headName: string;
  headBasis: string;
}

function normalizeLegalText(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
}

function legalSnapshotEquals(a: LegalFormSnapshot, b: LegalFormSnapshot): boolean {
  return a.legalForm === b.legalForm
    && normalizeLegalText(a.inn) === normalizeLegalText(b.inn)
    && normalizeLegalText(a.ogrn) === normalizeLegalText(b.ogrn)
    && normalizeLegalText(a.kpp) === normalizeLegalText(b.kpp)
    && normalizeLegalText(a.legalAddress) === normalizeLegalText(b.legalAddress)
    && normalizeLegalText(a.headName) === normalizeLegalText(b.headName)
    && normalizeLegalText(a.headBasis) === normalizeLegalText(b.headBasis);
}

function partyToLegalSnapshot(
  party: OrganizationRegistryParty,
  fallbackForm: OrganizationLegalFormValue,
  currentHeadBasis: string,
): LegalFormSnapshot {
  return {
    legalForm: party.legalForm ?? fallbackForm,
    inn: party.inn?.trim() ?? '',
    ogrn: party.ogrn?.trim() ?? '',
    kpp: party.kpp?.trim() ?? '',
    legalAddress: party.legalAddress?.trim() ?? '',
    headName: party.headName?.trim() ?? '',
    headBasis: currentHeadBasis,
  };
}

function resolveMyRole(
  org: OrganizationResponse,
  members: OrganizationMemberResponse[],
  myAccountId: string,
): OrganizationRoleValue | null {
  const fromMembers = members.find(m => m.accountId === myAccountId)?.role;
  if (fromMembers) return fromMembers;
  const embedded = org.members?.find(m => m.accountId === myAccountId)?.role;
  return embedded ?? null;
}

export function OrganizationsSettingsPanel({
  initialOrganizationId = null,
  onLeaveOrganizationDetail,
}: {
  initialOrganizationId?: string | null;
  onLeaveOrganizationDetail?: () => void;
} = {}) {
  const [view, setView] = useState<View>(() => (
    initialOrganizationId
      ? { kind: 'detail', id: initialOrganizationId }
      : { kind: 'list' }
  ));
  const [items, setItems] = useState<OrganizationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchMyOrganizations();
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить организации');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (initialOrganizationId) {
      setView({ kind: 'detail', id: initialOrganizationId });
    }
  }, [initialOrganizationId]);

  const goList = () => {
    void reload();
    setView({ kind: 'list' });
    onLeaveOrganizationDetail?.();
  };

  if (view.kind === 'create') {
    return (
      <OrganizationCreateView
        onCancel={() => setView({ kind: 'list' })}
        onCreated={id => {
          void reload();
          setView({ kind: 'detail', id });
        }}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <OrganizationDetailView
        organizationId={view.id}
        onBack={goList}
      />
    );
  }

  const showHeaderCreate = !loading && !err && items.length > 0;

  return (
    <>
      <div className={styles.scard}>
        <div className={styles.scardHead}>
          <div>
            <div className={styles.scardTitle}>Мои организации</div>
            <div className={styles.scardDesc}>
              Создавайте организации, добавляйте администраторов и подключайте продажу билетов
            </div>
          </div>
          {showHeaderCreate && (
            <Button size="sm" onClick={() => setView({ kind: 'create' })}>
              Создать
            </Button>
          )}
        </div>

        {loading && <div className={styles.loader}>Загрузка...</div>}
        {!loading && err && <div className={styles.bannerErr}>{err}</div>}
        {!loading && !err && items.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Организаций пока нет</p>
            <p className={styles.emptySub}>
              Создайте организацию, чтобы публиковать анонсы от её имени и позже подключить продажу билетов
            </p>
            <Button onClick={() => setView({ kind: 'create' })}>Создать организацию</Button>
          </div>
        )}
        {!loading && items.length > 0 && (
          <ul className={styles.orgList}>
            {items.map(org => (
              <li key={org.id}>
                <button
                  type="button"
                  className={styles.orgCard}
                  onClick={() => setView({ kind: 'detail', id: org.id })}
                >
                  <div className={styles.orgCardHead}>
                    <span className={styles.orgName}>{org.name}</span>
                    <div className={styles.orgBadges}>
                      {shouldShowVerificationBadge(org) && (
                        <span className={`${styles.badge} ${statusClass(org.verificationStatus)}`}>
                          {formatVerificationStatus(org.verificationStatus)}
                        </span>
                      )}
                      {!org.active && (
                        <span className={`${styles.badge} ${styles.badgeMute}`}>Неактивна</span>
                      )}
                      {org.canSellTickets && (
                        <span className={`${styles.badge} ${styles.badgeOk}`}>Билеты</span>
                      )}
                    </div>
                  </div>
                  <span className={styles.orgMeta}>
                    {org.address || 'Адрес не указан'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function OrganizationCreateView({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [doc, setDoc] = useState<IAgreementDocument | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [docOpen, setDocOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const userCoords = getStoredUserCoords() ?? { lat: 55.7558, lng: 37.6173 };

  useEffect(() => {
    let cancelled = false;
    setDocLoading(true);
    fetchLastDocument(DocumentType.OrganizationAgreement)
      .then(last => {
        if (!cancelled) setDoc(last);
      })
      .catch(() => {
        if (!cancelled) setDoc(null);
      })
      .finally(() => {
        if (!cancelled) setDocLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const canSubmit = name.trim().length > 0 && accepted && !saving;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setMsg(null);
    try {
      // Сначала создаём организацию, затем принимаем оферту от её имени
      const id = await createOrganization({
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        latitude: lat,
        longitude: lng,
      });
      try {
        await agreeOrganizationDocument(id, DocumentType.OrganizationAgreement);
      } catch (agreeErr) {
        // Организация уже создана — открываем её, согласие можно повторить позже при необходимости
        setMsg({
          text: agreeErr instanceof Error
            ? `Организация создана, но не удалось сохранить согласие: ${agreeErr.message}`
            : 'Организация создана, но не удалось сохранить согласие',
          ok: false,
        });
        onCreated(id);
        return;
      }
      onCreated(id);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось создать организацию', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div>
          <div className={styles.scardTitle}>Новая организация</div>
          <div className={styles.scardDesc}>
            После создания вы станете владельцем. Продажа билетов подключается отдельно после верификации.
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>Назад</Button>
      </div>
      <div className={styles.formBody}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Название *</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название организации"
            maxLength={200}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Описание</span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Кратко об организации"
            rows={3}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Адрес</span>
          <YandexMapPicker
            lat={lat}
            lng={lng}
            address={address}
            initialCenter={lat === null ? [userCoords.lat, userCoords.lng] : undefined}
            onAddressChange={setAddress}
            onPick={(la, lo, addr) => {
              setLat(la);
              setLng(lo);
              setAddress(addr);
            }}
          />
        </div>

        <div className={styles.agreeRow}>
          <input
            id="org-agree"
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
          />
          <label htmlFor="org-agree" className={styles.agreeLabel}>
            Принимаю{' '}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setDocOpen(true)}
              disabled={!doc}
            >
              договор оферты с организацией
            </button>
            {docLoading && <span className={styles.agreeHint}> (загрузка документа…)</span>}
            {!docLoading && !doc && (
              <span className={styles.agreeHint}> (документ пока недоступен на сервере)</span>
            )}
          </label>
        </div>

        {msg && <div className={msg.ok ? styles.bannerOk : styles.bannerErr}>{msg.text}</div>}
      </div>
      <div className={styles.scardFooter}>
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button loading={saving} disabled={!canSubmit} onClick={() => { void handleCreate(); }}>
          Создать
        </Button>
      </div>

      {docOpen && (
        <AgreementDocumentModal
          doc={doc}
          onClose={() => setDocOpen(false)}
        />
      )}
    </div>
  );
}

function OrganizationDetailView({
  organizationId,
  onBack,
}: {
  organizationId: string;
  onBack: () => void;
}) {
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [myAccountId, setMyAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [section, setSection] = useState<'profile' | 'members' | 'legal' | 'requisites' | 'sales'>('profile');

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const accountId = await getOrFetchAccountId();
      setMyAccountId(accountId);
      const [o, m, av] = await Promise.all([
        fetchOrganizationById(organizationId),
        fetchOrganizationMembers(organizationId).catch(() => [] as OrganizationMemberResponse[]),
        getOrganizationAvatar(organizationId),
      ]);
      setOrg(o);
      setMembers(m.length ? m : (o.members ?? []));
      setAvatarId(av);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить организацию');
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const myRole = useMemo(
    () => (org ? resolveMyRole(org, members, myAccountId) : null),
    [org, members, myAccountId],
  );

  const isOwner = myRole === OrganizationRole.Owner;
  const canEdit = myRole === OrganizationRole.Owner || myRole === OrganizationRole.Manager;

  if (loading) return <div className={styles.loader}>Загрузка...</div>;
  if (err || !org) {
    return (
      <div className={styles.scard}>
        <div className={styles.bannerErr}>{err ?? 'Организация не найдена'}</div>
        <div className={styles.scardFooter}>
          <Button variant="secondary" onClick={onBack}>Назад</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.scard}>
        <div className={styles.scardHead}>
          <div className={styles.detailHead}>
            <Button variant="ghost" size="sm" onClick={onBack}>← К списку</Button>
            <div>
              <div className={styles.scardTitle}>{org.name}</div>
              <div className={styles.scardDesc}>
                {shouldShowVerificationBadge(org) && (
                  <span className={`${styles.badge} ${statusClass(org.verificationStatus)}`}>
                    {formatVerificationStatus(org.verificationStatus)}
                  </span>
                )}
                {myRole && (
                  <span className={`${styles.badge} ${styles.badgeMute}`}>
                    {formatOrganizationRole(myRole)}
                  </span>
                )}
                {!org.active && (
                  <span className={`${styles.badge} ${styles.badgeMute}`}>Неактивна</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.subTabs}>
          {(
            [
              { id: 'profile' as const, label: 'Профиль' },
              { id: 'members' as const, label: 'Команда' },
              { id: 'legal' as const, label: 'Юридические данные' },
              { id: 'requisites' as const, label: 'Реквизиты' },
              { id: 'sales' as const, label: 'Продажа билетов' },
            ]
          ).map(t => (
            <button
              key={t.id}
              type="button"
              className={`${styles.subTab} ${section === t.id ? styles.subTabActive : ''}`}
              onClick={() => setSection(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'profile' && (
        <>
          <OrganizationProfileSection
            org={org}
            avatarId={avatarId}
            canEdit={canEdit}
            isOwner={isOwner}
            onAvatarChanged={setAvatarId}
            onUpdated={reload}
          />
          <OrganizationContactsSection
            organizationId={organizationId}
            canEdit={canEdit}
          />
          <OrganizationAgreementsSection
            organizationId={organizationId}
            organizationName={org.name}
            isOwner={isOwner}
          />
        </>
      )}
      {section === 'members' && (
        <OrganizationMembersSection
          organizationId={organizationId}
          members={members}
          isOwner={isOwner}
          myAccountId={myAccountId}
          onChanged={reload}
        />
      )}
      {(section === 'legal' || section === 'requisites' || section === 'sales') && (
        <OrganizationBillingSection
          view={section}
          organizationId={organizationId}
          org={org}
          isOwner={isOwner}
          canEdit={canEdit}
          onChanged={reload}
        />
      )}
    </>
  );
}

function OrganizationProfileSection({
  org,
  avatarId,
  canEdit,
  isOwner,
  onAvatarChanged,
  onUpdated,
}: {
  org: OrganizationResponse;
  avatarId: string | null;
  canEdit: boolean;
  isOwner: boolean;
  onAvatarChanged: (id: string) => void;
  onUpdated: () => Promise<void>;
}) {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? '');
  const [address, setAddress] = useState(org.address ?? '');
  const [lat, setLat] = useState<number | null>(org.latitude ?? null);
  const [lng, setLng] = useState<number | null>(org.longitude ?? null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const userCoords = getStoredUserCoords() ?? { lat: 55.7558, lng: 37.6173 };

  const [wallet, setWallet] = useState<IWallet | null>(null);
  const [orgTariffs, setOrgTariffs] = useState<ITariff[]>([]);
  const [currentTariff, setCurrentTariff] = useState<ITariff | null>(null);
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [tariffLoading, setTariffLoading] = useState(true);
  const [tariffSaving, setTariffSaving] = useState(false);

  useEffect(() => {
    setName(org.name);
    setDescription(org.description ?? '');
    setAddress(org.address ?? '');
    setLat(org.latitude ?? null);
    setLng(org.longitude ?? null);
  }, [org]);

  const loadTariffState = useCallback(async () => {
    setTariffLoading(true);
    try {
      const [w, tariffs] = await Promise.all([
        getWalletByOrganization(org.id),
        tariffApi.getAll(true).catch(() => [] as ITariff[]),
      ]);
      const sorted = [...tariffs].sort((a, b) => a.cost - b.cost);
      setOrgTariffs(sorted);
      setWallet(w);
      const tariffId = w?.tariffId ?? null;
      const matched = tariffId ? sorted.find(t => t.id === tariffId) ?? null : null;
      setCurrentTariff(matched);
      setSelectedTariffId(tariffId ?? '');
    } finally {
      setTariffLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    void loadTariffState();
  }, [loadTariffState]);

  const handleSave = async () => {
    if (!canEdit || !name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      await updateOrganization(org.id, {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        latitude: lat,
        longitude: lng,
      });
      setMsg({ text: 'Сохранено', ok: true });
      await onUpdated();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка сохранения', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!isOwner) return;
    setToggling(true);
    setMsg(null);
    try {
      await setOrganizationActive(org.id, !org.active);
      setMsg({ text: org.active ? 'Организация отключена' : 'Организация включена', ok: true });
      await onUpdated();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось изменить статус', ok: false });
    } finally {
      setToggling(false);
    }
  };

  const handleApplyTariff = async () => {
    if (!canEdit || !selectedTariffId || selectedTariffId === currentTariff?.id) return;
    setTariffSaving(true);
    setMsg(null);
    try {
      const w = wallet?.id ? wallet : await ensureOrganizationWallet(org.id);
      await setWalletTariff(w.id, selectedTariffId);
      setWallet(w);
      setMsg({ text: 'Тариф организации обновлён', ok: true });
      await loadTariffState();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось сменить тариф', ok: false });
    } finally {
      setTariffSaving(false);
    }
  };

  const initials = name.trim().slice(0, 2) || 'Орг';
  const tariffOptions = orgTariffs.map(t => ({
    value: t.id,
    label: formatOrgTariffLabel(t),
  }));
  const canApplyTariff =
    canEdit
    && !!selectedTariffId
    && selectedTariffId !== (currentTariff?.id ?? wallet?.tariffId ?? '');

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div className={styles.scardTitle}>Профиль организации</div>
      </div>
      <div className={styles.formBody}>
        <div className={styles.logoRow}>
          {canEdit ? (
            <OrgLogoUpload
              organizationId={org.id}
              fileId={avatarId}
              initials={initials}
              onChanged={onAvatarChanged}
            />
          ) : (
            <div className={styles.logoBtn}>
              <span className={styles.logoInitials}>{initials.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div>
            <div className={styles.logoTitle}>Логотип</div>
            <div className={styles.scardDesc}>JPG, PNG · до 5 МБ</div>
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Название *</span>
          <input
            className={styles.input}
            value={name}
            disabled={!canEdit}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Описание</span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={description}
            disabled={!canEdit}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Адрес</span>
          {canEdit ? (
            <YandexMapPicker
              lat={lat}
              lng={lng}
              address={address}
              initialCenter={lat === null ? [userCoords.lat, userCoords.lng] : undefined}
              onAddressChange={setAddress}
              onPick={(la, lo, addr) => {
                setLat(la);
                setLng(lo);
                setAddress(addr);
              }}
            />
          ) : (
            <div className={styles.readonlyAddress}>
              {address || 'Адрес не указан'}
              {lat != null && lng != null && (
                <span className={styles.readonlyCoords}>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              )}
            </div>
          )}
        </div>

        <div className={styles.tariffBlock}>
          <div className={styles.tariffCurrent}>
            <span className={styles.tariffCurrentLabel}>Текущий тариф</span>
            <span className={`${styles.tariffCurrentValue} ${!currentTariff ? styles.tariffCurrentMuted : ''}`}>
              {tariffLoading
                ? 'Загрузка...'
                : currentTariff
                  ? formatOrgTariffLabel(currentTariff)
                  : wallet?.tariffId
                    ? `Тариф выбран (id: ${wallet.tariffId.slice(0, 8)}…)`
                    : 'Не выбран'}
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Тариф организации</span>
            {tariffLoading ? (
              <div className={styles.tariffCurrentMuted}>Загрузка тарифов...</div>
            ) : orgTariffs.length === 0 ? (
              <div className={styles.tariffCurrentMuted}>
                Нет доступных тарифов для организаций. Обратитесь к администратору.
              </div>
            ) : (
              <Select
                value={selectedTariffId}
                disabled={!canEdit}
                placeholder="Выберите тариф"
                onChange={setSelectedTariffId}
                options={tariffOptions}
              />
            )}
          </div>

          {canApplyTariff && (
            <div className={styles.tariffApplyRow}>
              <Button
                size="sm"
                loading={tariffSaving}
                onClick={() => { void handleApplyTariff(); }}
              >
                Применить тариф
              </Button>
            </div>
          )}
        </div>

        {msg && <div className={msg.ok ? styles.bannerOk : styles.bannerErr}>{msg.text}</div>}
      </div>
      <div className={styles.scardFooter}>
        {isOwner && (
          <Button
            variant="secondary"
            size="sm"
            loading={toggling}
            onClick={() => { void handleToggleActive(); }}
          >
            {org.active ? 'Отключить' : 'Включить'}
          </Button>
        )}
        <div className={styles.footerSpacer} />
        {canEdit && (
          <Button loading={saving} disabled={!name.trim()} onClick={() => { void handleSave(); }}>
            Сохранить
          </Button>
        )}
      </div>
    </div>
  );
}

function OrganizationContactsSection({
  organizationId,
  canEdit,
}: {
  organizationId: string;
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState<IContactDataItem[]>([]);
  const [contactTypes, setContactTypes] = useState<IContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([
      fetchOrganizationContacts(organizationId),
      fetchContactTypes(),
    ]);
    setContacts(c);
    setContactTypes(t);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    setLoading(true);
    setEditingId(null);
    setAddingNew(false);
    setMsg(null);
    void load();
  }, [load]);

  if (loading) {
    return <div className={styles.loader}>Загрузка контактов...</div>;
  }

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div>
          <div className={styles.scardTitle}>Контактные данные</div>
          <div className={styles.scardDesc}>
            Публичные контакты видны на странице организации
          </div>
        </div>
      </div>
      {msg && (
        <div className={msg.ok ? styles.bannerOk : styles.bannerErr}>{msg.text}</div>
      )}
      <div className={styles.contactBody}>
        {contacts.length === 0 && !addingNew && (
          <p className={styles.emptyInline}>Контактов пока нет</p>
        )}
        {contacts.map(c => (
          editingId === c.id ? (
            <OrgContactForm
              key={c.id}
              types={contactTypes}
              initial={c}
              onSave={async data => {
                await updateOrganizationContact(c.id, data);
                setEditingId(null);
                setMsg({ text: 'Контакт обновлён', ok: true });
                await load();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <OrgContactRow
              key={c.id}
              contact={c}
              canEdit={canEdit}
              onEdit={() => {
                setEditingId(c.id);
                setAddingNew(false);
              }}
            />
          )
        ))}
        {addingNew && (
          <OrgContactForm
            types={contactTypes}
            onSave={async data => {
              await createOrganizationContact(organizationId, data);
              setAddingNew(false);
              setMsg({ text: 'Контакт добавлен', ok: true });
              await load();
            }}
            onCancel={() => setAddingNew(false)}
          />
        )}
      </div>
      {canEdit && (
        <div className={styles.scardFooter}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAddingNew(true);
              setEditingId(null);
            }}
          >
            + Добавить контакт
          </Button>
          <div className={styles.footerSpacer} />
        </div>
      )}
    </div>
  );
}

function OrgContactRow({
  contact,
  canEdit,
  onEdit,
}: {
  contact: IContactDataItem;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const typeName = contact.contactType?.name
    ?? contact.contactType?.localizedName
    ?? 'Контакт';

  return (
    <div className={styles.contactRow}>
      <div className={styles.creInfo}>
        <div className={styles.creType}>{typeName}</div>
        <div className={styles.creVal}>{contact.value}</div>
      </div>
      <div className={styles.creBadges}>
        {contact.show
          ? <span className={`${styles.creBadge} ${styles.crePub}`}>публичный</span>
          : <span className={`${styles.creBadge} ${styles.crePriv}`}>скрытый</span>}
      </div>
      {canEdit && (
        <div className={styles.creActions}>
          <button type="button" className={styles.iconBtn} onClick={onEdit} title="Редактировать">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function OrgContactForm({
  types,
  initial,
  onSave,
  onCancel,
}: {
  types: IContactType[];
  initial?: IContactDataItem;
  onSave: (data: IContactRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IContactRequest>({
    typeId: initial?.contactType?.id ?? (types[0]?.id ?? ''),
    value: initial?.value ?? '',
    show: initial?.show ?? true,
    isAuthorizationContact: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.value.trim() || !form.typeId) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        value: form.value.trim(),
        isAuthorizationContact: false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.contactForm}>
      <Select
        value={form.typeId}
        onChange={v => setForm(f => ({ ...f, typeId: v }))}
        options={types.map(t => ({ value: t.id, label: t.name || t.localizedName || '' }))}
      />
      <input
        className={styles.input}
        placeholder="Значение"
        value={form.value}
        onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
      />
      <div className={styles.contactFormFlags}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.show}
            onChange={e => setForm(f => ({ ...f, show: e.target.checked }))}
          />
          Показывать публично
        </label>
      </div>
      <div className={styles.contactFormActions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Отмена</Button>
        <Button size="sm" onClick={() => { void handleSave(); }} loading={saving}>
          {initial ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </div>
  );
}

const ORG_DOCUMENT_TYPES: DocumentTypeValue[] = [
  DocumentType.OrganizationAgreement,
  DocumentType.TicketingAgreement,
];

function OrganizationAgreementsSection({
  organizationId,
  organizationName,
  isOwner,
}: {
  organizationId: string;
  organizationName: string;
  isOwner: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{
    type: DocumentTypeValue;
    label: string;
    document: IAgreementDocument | null;
    agreed: boolean | null;
  }[]>([]);
  const [viewDoc, setViewDoc] = useState<IAgreementDocument | null>(null);
  const [acceptQueue, setAcceptQueue] = useState<{
    type: DocumentTypeValue;
    document: IAgreementDocument;
  }[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next: {
          type: DocumentTypeValue;
          label: string;
          document: IAgreementDocument | null;
          agreed: boolean | null;
        }[] = [];
        for (const type of ORG_DOCUMENT_TYPES) {
          const label =
            DOCUMENT_TYPE_LABELS.find(x => x.value === type)?.label ?? String(type);
          const [document, agreed] = await Promise.all([
            fetchLastDocument(type).catch(() => null),
            checkOrganizationAgreement(organizationId, type).catch(() => null),
          ]);
          next.push({ type, label, document, agreed });
        }
        if (!cancelled) setRows(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, reloadKey]);

  const openRow = (row: (typeof rows)[number]) => {
    if (!row.document) return;
    const needsAccept = isOwner && row.agreed !== true;
    if (needsAccept) {
      setAcceptQueue([{ type: row.type, document: row.document }]);
      return;
    }
    setViewDoc(row.document);
  };

  return (
    <div className={styles.scard}>
      <div className={styles.scardHead}>
        <div className={styles.scardTitle}>Документы организации</div>
        <div className={styles.scardDesc}>
          Нажмите на документ, чтобы прочитать
          {isOwner ? ' или принять согласие' : ''}
        </div>
      </div>
      <div className={styles.formBody}>
        {loading ? (
          <div className={styles.tariffCurrentMuted}>Загрузка...</div>
        ) : (
          <ul className={styles.orgDocsList}>
            {rows.map(row => {
              const clickable = !!row.document;
              return (
                <li key={row.type}>
                  <button
                    type="button"
                    className={`${styles.orgDocRow} ${clickable ? styles.orgDocRowClickable : styles.orgDocRowDisabled}`}
                    disabled={!clickable}
                    onClick={() => openRow(row)}
                  >
                    <div className={styles.orgDocMain}>
                      <span className={styles.orgDocName}>{row.label}</span>
                      <span
                        className={`${styles.orgDocStatus} ${
                          row.agreed === true
                            ? styles.orgDocStatusOk
                            : row.agreed === false
                              ? styles.orgDocStatusNo
                              : styles.orgDocStatusMute
                        }`}
                      >
                        {row.agreed === true
                          ? 'Принято'
                          : row.document
                            ? 'Не принято'
                            : 'Нет данных'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {viewDoc && (
        <AgreementDocumentModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
        />
      )}
      {acceptQueue.length > 0 && (
        <OrgAgreementAcceptDialog
          organizationId={organizationId}
          organizationName={organizationName}
          queue={acceptQueue}
          onCancel={() => setAcceptQueue([])}
          onComplete={() => {
            setAcceptQueue([]);
            setReloadKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}

function OrganizationMembersSection({
  organizationId,
  members,
  isOwner,
  myAccountId,
  onChanged,
}: {
  organizationId: string;
  members: OrganizationMemberResponse[];
  isOwner: boolean;
  myAccountId: string;
  onChanged: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [transferId, setTransferId] = useState('');

  const handleAdd = async () => {
    const id = accountId.trim();
    if (!id || !isOwner) return;
    setBusy(true);
    setMsg(null);
    try {
      await addOrganizationManager(organizationId, { accountId: id });
      setAccountId('');
      setMsg({ text: 'Администратор добавлен', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось добавить', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (memberAccountId: string) => {
    if (!isOwner) return;
    setBusy(true);
    setMsg(null);
    try {
      await removeOrganizationMember(organizationId, memberAccountId);
      setMsg({ text: 'Участник удалён', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось удалить', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMember = async (memberAccountId: string, active: boolean) => {
    if (!isOwner) return;
    setBusy(true);
    setMsg(null);
    try {
      await setOrganizationMemberActive(organizationId, memberAccountId, active);
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось изменить статус', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    const id = transferId.trim();
    if (!id || !isOwner) return;
    if (!window.confirm('Передать владение организацией? Вы станете администратором.')) return;
    setBusy(true);
    setMsg(null);
    try {
      await transferOrganizationOwnership(organizationId, { newOwnerAccountId: id });
      setTransferId('');
      setMsg({ text: 'Владение передано', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось передать владение', ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.scard}>
        <div className={styles.scardHead}>
          <div className={styles.scardTitle}>Команда</div>
          <div className={styles.scardDesc}>
            Администраторы могут редактировать профиль. Владелец управляет составом и продажами.
          </div>
        </div>
        <ul className={styles.memberList}>
          {members.map(m => {
            const isMe = m.accountId === myAccountId;
            const isMemberOwner = m.role === OrganizationRole.Owner;
            return (
              <li key={m.accountId} className={styles.memberRow}>
                <UserAvatar
                  accountId={m.accountId}
                  avatarId={organizationMemberAvatarId(m)}
                  initials={organizationMemberInitials(m)}
                  size={32}
                />
                <div className={styles.memberInfo}>
                  <div className={styles.memberName}>
                    {organizationMemberDisplayName(m)}
                    {isMe && <span className={styles.youTag}>вы</span>}
                  </div>
                  <div className={styles.memberMeta}>
                    {formatOrganizationRole(m.role)}
                    {!m.active && ' · приостановлен'}
                  </div>
                </div>
                {isOwner && !isMemberOwner && (
                  <div className={styles.memberActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => { void handleToggleMember(m.accountId, !m.active); }}
                    >
                      {m.active ? 'Приостановить' : 'Включить'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => { void handleRemove(m.accountId); }}
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
          {members.length === 0 && (
            <li className={styles.emptyInline}>Участники не загружены</li>
          )}
        </ul>
      </div>

      {isOwner && (
        <div className={styles.scard}>
          <div className={styles.scardHead}>
            <div className={styles.scardTitle}>Добавить администратора</div>
            <div className={styles.scardDesc}>Укажите accountId пользователя</div>
          </div>
          <div className={styles.formBody}>
            <div className={styles.inlineForm}>
              <input
                className={styles.input}
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder="UUID аккаунта"
              />
              <Button
                loading={busy}
                disabled={!accountId.trim()}
                onClick={() => { void handleAdd(); }}
              >
                Добавить
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwner && (
        <div className={styles.scard}>
          <div className={styles.scardHead}>
            <div className={styles.scardTitle}>Передать владение</div>
          </div>
          <div className={styles.formBody}>
            <div className={styles.inlineForm}>
              <input
                className={styles.input}
                value={transferId}
                onChange={e => setTransferId(e.target.value)}
                placeholder="UUID нового владельца"
              />
              <Button
                variant="secondary"
                loading={busy}
                disabled={!transferId.trim()}
                onClick={() => { void handleTransfer(); }}
              >
                Передать
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className={msg.ok ? styles.bannerOk : styles.bannerErr}>{msg.text}</div>}
    </>
  );
}

function OrganizationBillingSection({
  view,
  organizationId,
  org,
  isOwner,
  canEdit,
  onChanged,
}: {
  view: 'legal' | 'requisites' | 'sales';
  organizationId: string;
  org: OrganizationResponse;
  isOwner: boolean;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [legalForm, setLegalForm] = useState<OrganizationLegalFormValue>(
    OrganizationLegalForm.Ip,
  );
  const [inn, setInn] = useState('');
  const [ogrn, setOgrn] = useState('');
  const [kpp, setKpp] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [headName, setHeadName] = useState('');
  const [headBasis, setHeadBasis] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bik, setBik] = useState('');
  const [bankName, setBankName] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState(
    OrganizationOnboardingStatus.None as string,
  );
  const [ticketingAgreed, setTicketingAgreed] = useState(false);
  const [ticketingAccepted, setTicketingAccepted] = useState(false);
  const [ticketingDoc, setTicketingDoc] = useState<IAgreementDocument | null>(null);
  const [ticketingDocOpen, setTicketingDocOpen] = useState(false);
  const [innLookupOpen, setInnLookupOpen] = useState(false);
  const [confirmLegalSaveOpen, setConfirmLegalSaveOpen] = useState(false);
  const [registryBaseline, setRegistryBaseline] = useState<LegalFormSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [legal, payout, agreed, doc] = await Promise.all([
          fetchOrganizationLegal(organizationId),
          fetchOrganizationPayout(organizationId),
          checkOrganizationAgreement(organizationId, DocumentType.TicketingAgreement).catch(() => false),
          fetchLastDocument(DocumentType.TicketingAgreement).catch(() => null),
        ]);
        if (cancelled) return;
        const L = legal ?? org.legal;
        const P = payout ?? org.payout;
        if (L) {
          setLegalForm(L.legalForm);
          setInn(L.inn ?? '');
          setOgrn(L.ogrn ?? '');
          setKpp(L.kpp ?? '');
          setLegalAddress(L.legalAddress ?? '');
          setHeadName(L.headName ?? '');
          setHeadBasis(L.headBasis ?? '');
        }
        setRegistryBaseline(null);
        if (P) {
          setBankAccount(P.bankAccount ?? '');
          setBik(P.bik ?? '');
          setBankName(P.bankName ?? '');
          setTaxRegime(P.taxRegime ?? '');
          setOnboardingStatus(P.onboardingStatus ?? OrganizationOnboardingStatus.None);
        }
        setTicketingAgreed(agreed);
        setTicketingAccepted(agreed);
        setTicketingDoc(doc);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, org.legal, org.payout]);

  const isSelfEmployed = legalForm === OrganizationLegalForm.SelfEmployed;
  const legalFilled = Boolean(inn.trim() && legalAddress.trim() && headName.trim() && !isSelfEmployed);
  const payoutFilled = Boolean(bankAccount.trim() && bik.trim() && bankName.trim());
  const verified = org.verificationStatus === OrganizationVerificationStatus.Verified;
  const pending = org.verificationStatus === OrganizationVerificationStatus.Pending;
  const rejected = org.verificationStatus === OrganizationVerificationStatus.Rejected;
  const onboardingActive = onboardingStatus === OrganizationOnboardingStatus.Active;

  const currentLegalSnapshot = (): LegalFormSnapshot => ({
    legalForm,
    inn,
    ogrn,
    kpp,
    legalAddress,
    headName,
    headBasis,
  });

  const checklist = [
    { ok: ticketingAgreed, label: 'Соглашение на продажу билетов принято' },
    { ok: legalFilled, label: 'Юридические данные заполнены' },
    { ok: payoutFilled, label: 'Реквизиты заполнены' },
    { ok: verified, label: 'Верификация пройдена' },
    { ok: onboardingActive, label: 'Онбординг выплат активен' },
  ];

  const acceptTicketingAgreement = async () => {
    if (!isOwner || !ticketingAccepted || ticketingAgreed) return;
    setBusy(true);
    setMsg(null);
    try {
      await agreeOrganizationDocument(organizationId, DocumentType.TicketingAgreement);
      setTicketingAgreed(true);
      setMsg({ text: 'Соглашение на продажу билетов принято', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось сохранить согласие', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const applyRegistryParty = (party: OrganizationRegistryParty) => {
    const next = partyToLegalSnapshot(party, legalForm, headBasis);
    setLegalForm(next.legalForm);
    setInn(next.inn);
    setOgrn(next.ogrn);
    setKpp(next.kpp);
    setLegalAddress(next.legalAddress);
    setHeadName(next.headName);
    setRegistryBaseline(next);
    setInnLookupOpen(false);
    setMsg({
      text: party.isActive
        ? 'Данные из реестра подставлены в форму'
        : 'Данные подставлены. Внимание: организация не в статусе «Действует»',
      ok: party.isActive,
    });
  };

  const saveLegal = async () => {
    if (!isOwner) return;
    if (isSelfEmployed) {
      setMsg({
        text: 'Платный тир доступен только для ИП и юридических лиц',
        ok: false,
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    setConfirmLegalSaveOpen(false);
    try {
      const payload: OrganizationLegalRequest = {
        legalForm,
        inn: inn.trim(),
        ogrn: ogrn.trim() || null,
        kpp: kpp.trim() || null,
        legalAddress: legalAddress.trim(),
        headName: headName.trim(),
        headBasis: headBasis.trim() || null,
      };
      await saveOrganizationLegal(organizationId, payload);
      setRegistryBaseline(null);
      setMsg({ text: 'Юридические данные сохранены', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка сохранения', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const requestSaveLegal = () => {
    if (!isOwner) return;
    if (isSelfEmployed) {
      setMsg({
        text: 'Платный тир доступен только для ИП и юридических лиц',
        ok: false,
      });
      return;
    }
    if (registryBaseline && !legalSnapshotEquals(registryBaseline, currentLegalSnapshot())) {
      setConfirmLegalSaveOpen(true);
      return;
    }
    void saveLegal();
  };

  const savePayout = async () => {
    if (!isOwner) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload: OrganizationPayoutRequest = {
        bankAccount: bankAccount.trim(),
        bik: bik.trim(),
        bankName: bankName.trim(),
        taxRegime: taxRegime.trim() || null,
      };
      await saveOrganizationPayout(organizationId, payload);
      setMsg({ text: 'Реквизиты сохранены', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка сохранения', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const submitVerification = async () => {
    if (!isOwner) return;
    if (!ticketingAgreed) {
      setMsg({ text: 'Сначала примите соглашение на продажу билетов', ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await submitOrganizationVerification(organizationId);
      setMsg({ text: 'Заявка отправлена на проверку', ok: true });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось отправить на проверку', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const toggleTickets = async (enabled: boolean) => {
    if (!isOwner) return;
    if (enabled && !ticketingAgreed) {
      setMsg({ text: 'Сначала примите соглашение на продажу билетов', ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await setOrganizationTicketsEnabled(organizationId, enabled);
      setMsg({
        text: enabled ? 'Продажа билетов включена' : 'Продажа билетов отключена',
        ok: true,
      });
      await onChanged();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Не удалось изменить статус продаж', ok: false });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={styles.loader}>Загрузка...</div>;

  return (
    <>
      {view === 'sales' && (
        <>
          <div className={styles.scard}>
            <div className={styles.scardHead}>
              <div className={styles.scardTitle}>Соглашение на продажу билетов</div>
              <div className={styles.scardDesc}>
                Согласие принимается от имени организации и требуется для подключения продаж
              </div>
            </div>
            {ticketingAgreed ? (
              <div className={styles.formBody}>
                <div className={styles.bannerOk} style={{ margin: 0 }}>Соглашение принято</div>
              </div>
            ) : (
              <>
                <div className={styles.formBody}>
                  <div className={styles.agreeRow}>
                    <input
                      id="ticketing-agree"
                      type="checkbox"
                      checked={ticketingAccepted}
                      disabled={!isOwner}
                      onChange={e => setTicketingAccepted(e.target.checked)}
                    />
                    <label htmlFor="ticketing-agree" className={styles.agreeLabel}>
                      Принимаю{' '}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => setTicketingDocOpen(true)}
                        disabled={!ticketingDoc}
                      >
                        соглашение на продажу билетов
                      </button>
                      {!ticketingDoc && (
                        <span className={styles.agreeHint}> (документ пока недоступен на сервере)</span>
                      )}
                    </label>
                  </div>
                </div>
                {isOwner && (
                  <div className={styles.scardFooter}>
                    <div className={styles.footerSpacer} />
                    <Button
                      loading={busy}
                      disabled={!ticketingAccepted}
                      onClick={() => { void acceptTicketingAgreement(); }}
                    >
                      Принять соглашение
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.scard}>
            <div className={styles.scardHead}>
              <div className={styles.scardTitle}>Подключение продаж</div>
              <div className={styles.scardDesc}>
                Юридические данные и реквизиты можно заполнить заранее на отдельных вкладках.
                Включение продаж — после соглашения, верификации и онбординга (см. вкладку «Реквизиты»).
              </div>
            </div>
            {rejected && (
              <div className={styles.bannerWarn}>
                Верификация отклонена. Исправьте данные на вкладках «Юридические данные» и «Реквизиты».
              </div>
            )}
            {pending && (
              <div className={styles.bannerWarn}>Заявка на проверке. Обычно это занимает некоторое время.</div>
            )}
            <div className={styles.scardFooter}>
              <div className={styles.footerSpacer} />
              {isOwner && !org.canSellTickets && (
                <Button
                  loading={busy}
                  disabled={!verified || !ticketingAgreed}
                  title={
                    !ticketingAgreed
                      ? 'Нужно принять соглашение на продажу билетов'
                      : !verified
                        ? 'Нужна успешная верификация'
                        : undefined
                  }
                  onClick={() => { void toggleTickets(true); }}
                >
                  Включить продажу билетов
                </Button>
              )}
              {isOwner && org.canSellTickets && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => { void toggleTickets(false); }}
                >
                  Отключить продажу билетов
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'requisites' && (
        <>
          <div className={styles.scard}>
            <div className={styles.scardHead}>
              <div className={styles.scardTitle}>Готовность к продажам</div>
              <div className={styles.scardDesc}>
                Чеклист шагов перед подключением продажи билетов
              </div>
            </div>
            <ul className={styles.checkList}>
              {checklist.map(item => (
                <li key={item.label} className={item.ok ? styles.checkOk : styles.checkNo}>
                  <span className={styles.checkMark} aria-hidden>{item.ok ? '✓' : '·'}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.scard}>
            <div className={styles.scardHead}>
              <div className={styles.scardTitle}>Реквизиты</div>
              <div className={styles.scardDesc}>
                Банковские реквизиты для выплат · онбординг: {formatOnboardingStatus(onboardingStatus as never)}
              </div>
            </div>
            <div className={styles.formBody}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Расчётный счёт *</span>
                <input className={styles.input} value={bankAccount} disabled={!isOwner} onChange={e => setBankAccount(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>БИК *</span>
                <input className={styles.input} value={bik} disabled={!isOwner} onChange={e => setBik(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Банк *</span>
                <input className={styles.input} value={bankName} disabled={!isOwner} onChange={e => setBankName(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Налоговый режим</span>
                <input className={styles.input} value={taxRegime} disabled={!isOwner} onChange={e => setTaxRegime(e.target.value)} />
              </label>
            </div>
            {isOwner && (
              <div className={styles.scardFooter}>
                <div className={styles.footerSpacer} />
                <Button
                  loading={busy}
                  onClick={() => { void savePayout(); }}
                >
                  Сохранить реквизиты
                </Button>
              </div>
            )}
          </div>

          {isOwner && (
            <div className={styles.scard}>
              <div className={styles.scardHead}>
                <div className={styles.scardTitle}>Верификация</div>
                <div className={styles.scardDesc}>
                  Отправка на проверку требует заполненные юр. данные и реквизиты
                </div>
              </div>
              <div className={styles.scardFooter}>
                <div className={styles.footerSpacer} />
                <Button
                  loading={busy}
                  disabled={!ticketingAgreed || !legalFilled || !payoutFilled || pending}
                  title={!ticketingAgreed ? 'Сначала примите соглашение на продажу билетов' : undefined}
                  onClick={() => { void submitVerification(); }}
                >
                  {pending ? 'На проверке' : 'Отправить на проверку'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'legal' && (
        <div className={styles.scard}>
          <div className={styles.scardHead}>
            <div className={styles.scardTitle}>Юридические данные</div>
            <div className={styles.scardDesc}>
              Можно заполнить заранее, без подключения продажи билетов — вручную или по ИНН из реестра
            </div>
          </div>
          <div className={styles.formBody}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Правовая форма</span>
              <Select
                value={legalForm}
                disabled={!isOwner}
                onChange={v => setLegalForm(v as OrganizationLegalFormValue)}
                options={[
                  { value: OrganizationLegalForm.Ip, label: formatLegalForm(OrganizationLegalForm.Ip) },
                  { value: OrganizationLegalForm.LegalEntity, label: formatLegalForm(OrganizationLegalForm.LegalEntity) },
                  { value: OrganizationLegalForm.SelfEmployed, label: formatLegalForm(OrganizationLegalForm.SelfEmployed) },
                ]}
              />
            </label>
            {isSelfEmployed && (
              <div className={styles.bannerWarn}>
                Платный тир (продажа билетов) доступен только для ИП и юридических лиц.
              </div>
            )}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>ИНН *</span>
              <div className={styles.innRow}>
                <input
                  className={styles.input}
                  value={inn}
                  inputMode="numeric"
                  disabled={!isOwner}
                  onChange={e => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                />
                {isOwner && (
                  <Button
                    variant="secondary"
                    onClick={() => setInnLookupOpen(true)}
                  >
                    Найти по ИНН
                  </Button>
                )}
              </div>
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>ОГРН / ОГРНИП</span>
              <input className={styles.input} value={ogrn} disabled={!isOwner} onChange={e => setOgrn(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>КПП</span>
              <input className={styles.input} value={kpp} disabled={!isOwner} onChange={e => setKpp(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Юр. адрес *</span>
              <input className={styles.input} value={legalAddress} disabled={!isOwner} onChange={e => setLegalAddress(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>ФИО руководителя *</span>
              <input className={styles.input} value={headName} disabled={!isOwner} onChange={e => setHeadName(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Действует на основании</span>
              <input className={styles.input} value={headBasis} disabled={!isOwner} onChange={e => setHeadBasis(e.target.value)} placeholder="Устава / доверенности" />
            </label>
          </div>
          {isOwner && (
            <div className={styles.scardFooter}>
              <div className={styles.footerSpacer} />
              <Button
                loading={busy}
                onClick={requestSaveLegal}
              >
                Сохранить юр. данные
              </Button>
            </div>
          )}
          {!isOwner && canEdit && (
            <div className={styles.formBody}>
              <p className={styles.scardDesc}>Редактирование доступно только владельцу</p>
            </div>
          )}
        </div>
      )}

      {view === 'legal' && innLookupOpen && (
        <OrgInnLookupModal
          initialInn={inn}
          onClose={() => setInnLookupOpen(false)}
          onSelect={applyRegistryParty}
        />
      )}

      {view === 'legal' && confirmLegalSaveOpen && (
        <ConfirmDialog
          title="Проверьте данные"
          message="Вы изменили поля после автозаполнения из реестра. Подтвердите, что проверили корректность юридических данных перед сохранением."
          confirmLabel="Данные верны, сохранить"
          cancelLabel="Отмена"
          variant="accent"
          zIndex={630}
          onCancel={() => setConfirmLegalSaveOpen(false)}
          onConfirm={() => { void saveLegal(); }}
        />
      )}

      {view === 'sales' && ticketingDocOpen && (
        <AgreementDocumentModal
          doc={ticketingDoc}
          onClose={() => setTicketingDocOpen(false)}
        />
      )}

      {msg && <div className={msg.ok ? styles.bannerOk : styles.bannerErr}>{msg.text}</div>}
    </>
  );
}
