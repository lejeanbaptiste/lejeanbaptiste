import type { EntityKind } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { ENTITY_KINDS } from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';

/** Shared with the sidebar database tab and the full Database Window. */
export const KIND_FILTER_STORAGE_KEY = 'grognard:databaseKindFilter';
export const LAST_ENTITY_BY_KIND_STORAGE_KEY = 'grognard:databaseLastEntityByKind';

const KIND_FILTER_VALUES = Object.keys(ENTITY_KINDS) as EntityKind[];
export const DEFAULT_KIND_FILTER: EntityKind = 'person';

export const readStoredKindFilter = (): EntityKind => {
  try {
    const stored = localStorage.getItem(KIND_FILTER_STORAGE_KEY);
    if (stored && (KIND_FILTER_VALUES as string[]).includes(stored)) {
      return stored as EntityKind;
    }
  } catch {
    // Ignore storage access errors (private mode, etc.).
  }
  return DEFAULT_KIND_FILTER;
};

export const writeStoredKindFilter = (kind: EntityKind) => {
  try {
    localStorage.setItem(KIND_FILTER_STORAGE_KEY, kind);
  } catch {
    // Ignore storage access errors.
  }
};

type LastEntityByKind = Partial<Record<EntityKind, string>>;

const readLastEntityMap = (): LastEntityByKind => {
  try {
    const raw = localStorage.getItem(LAST_ENTITY_BY_KIND_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LastEntityByKind;
  } catch {
    return {};
  }
};

export const readLastEntityId = (kind: EntityKind): string | null => {
  const id = readLastEntityMap()[kind];
  return typeof id === 'string' && id ? id : null;
};

export const writeLastEntityId = (kind: EntityKind, id: string) => {
  try {
    const next = { ...readLastEntityMap(), [kind]: id };
    localStorage.setItem(LAST_ENTITY_BY_KIND_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage access errors.
  }
};

/** Prefer the last opened entity for this kind; otherwise the first in the list. */
export const pickDefaultEntityId = <T extends { id: string; kind: EntityKind }>(
  entities: T[],
  kind: EntityKind,
): string | null => {
  const inKind = entities.filter((entity) => entity.kind === kind);
  if (inKind.length === 0) return null;
  const preferred = readLastEntityId(kind);
  if (preferred && inKind.some((entity) => entity.id === preferred)) return preferred;
  return inKind[0]?.id ?? null;
};
