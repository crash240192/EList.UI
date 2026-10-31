import type { IEvent, IEventsSearchParams } from '@/entities/event';
import type { EventsPhase, OwnerFilter } from './useMyEvents';

const EMPTY_IDS: string[] = [];
const EMPTY_SNAPSHOTS: Record<string, IEvent> = {};

export { EMPTY_IDS, EMPTY_SNAPSHOTS };

export function myEventsQueryIsNarrowed(params: Partial<IEventsSearchParams>): boolean {
  return Boolean(
    params.name
    || (params.categories && params.categories.length > 0)
    || (params.types && params.types.length > 0)
    || params.startTime
    || params.endTime
    || params.price != null
    || params.ageLimit != null
    || params.adultOnly === true,
  );
}

function phaseOf(event: IEvent, now: number): EventsPhase | null {
  const start = Date.parse(event.startTime);
  if (!Number.isFinite(start)) return null;
  const endRaw = event.endTime ? Date.parse(event.endTime) : start;
  if (!Number.isFinite(endRaw)) return null;
  return endRaw <= now ? 'archive' : 'active';
}

function snapshotMatches(
  event: IEvent,
  tab: EventsPhase,
  owner: OwnerFilter,
  now: number,
): boolean {
  if (owner === 'cancelled') {
    if (event.active !== false) return false;
  } else if (event.active === false) {
    return false;
  }
  if (owner === 'mine' && !event.isOrganizer) return false;
  if (owner === 'others' && event.isOrganizer) return false;
  return phaseOf(event, now) === tab;
}

export function orderPinnedMyEvents(options: {
  events: IEvent[];
  ids: string[];
  snapshots: Record<string, IEvent>;
  allowSnapshots: boolean;
  tab: EventsPhase;
  owner: OwnerFilter;
  now?: number;
}): IEvent[] {
  const now = options.now ?? Date.now();
  const loaded = new Map(options.events.map((event) => [event.id, event]));
  const pinned: IEvent[] = [];
  const used = new Set<string>();

  for (const id of options.ids) {
    const fresh = loaded.get(id);
    if (fresh) {
      pinned.push(fresh);
      used.add(id);
      continue;
    }
    if (!options.allowSnapshots) continue;
    const snap = options.snapshots[id];
    if (!snap || !snapshotMatches(snap, options.tab, options.owner, now)) continue;
    pinned.push(snap);
    used.add(id);
  }

  if (used.size === 0) return options.events;
  return [...pinned, ...options.events.filter((event) => !used.has(event.id))];
}
