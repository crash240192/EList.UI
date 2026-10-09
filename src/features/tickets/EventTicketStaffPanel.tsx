// features/tickets/EventTicketStaffPanel.tsx
// Owner/Manager: назначить билетёров org на событие

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OrganizationRole,
  fetchOrganizationMembers,
  organizationMemberDisplayName,
  type OrganizationMemberResponse,
} from '@/entities/organization';
import {
  fetchEventOrganizators,
  fetchEventTicketStaff,
  setEventTicketStaff,
} from '@/entities/event';
import { useToastStore } from '@/app/store';
import { Button } from '@/shared/ui/Button';
import styles from './TicketCheckInPanel.module.css';

interface EventTicketStaffPanelProps {
  eventId: string;
}

export function EventTicketStaffPanel({ eventId }: EventTicketStaffPanelProps) {
  const toast = useToastStore(s => s.add);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ticketTakers, setTicketTakers] = useState<OrganizationMemberResponse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await fetchEventOrganizators(eventId);
      const firstOrgId = orgs.map(o => o.organizationId).find((id): id is string => !!id);
      setOrgId(firstOrgId ?? null);
      if (!firstOrgId) {
        setTicketTakers([]);
        setSelected(new Set());
        return;
      }

      const [members, staff] = await Promise.all([
        fetchOrganizationMembers(firstOrgId),
        fetchEventTicketStaff(eventId),
      ]);
      const takers = members.filter(
        m => m.active !== false && m.role === OrganizationRole.TicketTaker,
      );
      setTicketTakers(takers);
      setSelected(new Set(staff.map(s => s.accountId)));
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось загрузить билетёров', 'error');
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (accountId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setEventTicketStaff(
        eventId,
        Array.from(selected).map(accountId => ({ accountId })),
      );
      setDirty(false);
      toast('Билетёры сохранены', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  const emptyHint = useMemo(() => {
    if (!orgId) return 'Назначение билетёров доступно для мероприятий организации.';
    if (ticketTakers.length === 0) {
      return 'В организации пока нет билетёров. Добавьте роль «Билетёр» в настройках организации.';
    }
    return null;
  }, [orgId, ticketTakers.length]);

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.label}>Билетёры на входе</div>
        <p className={styles.hint}>Загрузка…</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.label}>Билетёры на входе</div>
      <p className={styles.hint}>
        Кто из билетёров организации может проверять и гасить билеты на этом мероприятии.
      </p>
      {emptyHint ? (
        <p className={styles.hint}>{emptyHint}</p>
      ) : (
        <ul className={styles.staffList}>
          {ticketTakers.map(m => {
            const checked = selected.has(m.accountId);
            return (
              <li key={m.accountId} className={styles.staffRow}>
                <label className={styles.staffLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m.accountId)}
                  />
                  <span>{organizationMemberDisplayName(m)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {orgId && ticketTakers.length > 0 && (
        <Button
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={() => { void handleSave(); }}
        >
          Сохранить назначения
        </Button>
      )}
    </div>
  );
}
