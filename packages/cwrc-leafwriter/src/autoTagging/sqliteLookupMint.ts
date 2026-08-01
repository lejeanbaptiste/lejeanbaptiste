/**
 * Typed SQLite mint / link / enrich for lookup and disambiguation — no
 * DOM `saveEntities` (which would full-reimport and clobber live SQLite).
 */

import type { AuthorityId, AuthoritySourcedFields, EntityKind } from './entities';
import { mintEntityId } from './entities';
import type { EntityStore } from './entityStore';
import type { OriginAssertion } from './authority';
import { SQLITE_REQUIRED_LOOKUP_MESSAGE } from './sqliteRequired';

export async function assertLookupSqliteStore(store: EntityStore): Promise<void> {
  if (
    !(await store.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteCreatePopulated ||
    !window.electronAPI?.entitySqliteAttachAuthority
  ) {
    throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
  }
}

export interface SqliteMintEntityInput {
  kind: EntityKind;
  name: string;
  nameLang?: string | null;
  romanizedName?: string | null;
  description?: string | null;
  authorityIds?: AuthorityId[];
  familyName?: string | null;
  givenName?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  nationality?: Array<{ label: string; canonicalId?: string; sourceIds?: string[] }>;
  authorityAssertions?: AuthoritySourcedFields[];
  authoritySource?: string | null;
  origin?: OriginAssertion[];
}

async function enrichPersonAuthority(
  store: EntityStore,
  entityId: string,
  input: {
    startYear?: number | null;
    endYear?: number | null;
    nationality?: Array<{ label: string; canonicalId?: string; sourceIds?: string[] }>;
    authorityAssertions?: AuthoritySourcedFields[];
    authoritySource?: string | null;
    origin?: OriginAssertion[];
  },
): Promise<void> {
  if (input.authorityAssertions?.length) {
    for (const assertion of input.authorityAssertions) {
      if (assertion.startYear != null) {
        await store.sqliteSetUserDate({
          entityId,
          part: 'birth',
          year: assertion.startYear,
        });
      }
      if (assertion.endYear != null) {
        await store.sqliteSetUserDate({
          entityId,
          part: 'death',
          year: assertion.endYear,
        });
      }
      for (const nationality of assertion.nationality ?? []) {
        await store.sqliteAddNationality({
          entityId,
          label: nationality.label,
          ref: nationality.canonicalId,
          source: assertion.source,
        });
      }
      for (const origin of assertion.origin ?? []) {
        await store.sqliteAddOrigin({
          entityId,
          label: origin.placeName,
          ref: origin.placeAuthorityId,
          source: origin.source ?? assertion.source,
        });
      }
    }
    return;
  }

  const source = input.authoritySource ?? 'authority';
  if (input.startYear != null) {
    await store.sqliteSetUserDate({ entityId, part: 'birth', year: input.startYear });
  }
  if (input.endYear != null) {
    await store.sqliteSetUserDate({ entityId, part: 'death', year: input.endYear });
  }
  for (const nationality of input.nationality ?? []) {
    await store.sqliteAddNationality({
      entityId,
      label: nationality.label,
      ref: nationality.canonicalId,
      source: nationality.sourceIds?.[0] ?? source,
    });
  }
  for (const origin of input.origin ?? []) {
    await store.sqliteAddOrigin({
      entityId,
      label: origin.placeName,
      ref: origin.placeAuthorityId,
      source: origin.source ?? source,
    });
  }
}

/** Attach missing authority ids and person enrich fields onto an existing entity. */
export async function enrichEntitySqlite(
  store: EntityStore,
  entityId: string,
  input: {
    kind: EntityKind;
    authorityIds?: AuthorityId[];
    startYear?: number | null;
    endYear?: number | null;
    nationality?: Array<{ label: string; canonicalId?: string; sourceIds?: string[] }>;
    authorityAssertions?: AuthoritySourcedFields[];
    authoritySource?: string | null;
    origin?: OriginAssertion[];
    romanizedName?: string | null;
    familyName?: string | null;
    givenName?: string | null;
    nameLang?: string | null;
  },
): Promise<void> {
  await assertLookupSqliteStore(store);
  for (const authority of input.authorityIds ?? []) {
    await store.sqliteAttachAuthority(entityId, authority.type, authority.value);
  }
  if (input.romanizedName) {
    await store.sqliteSetRomanizedName(entityId, input.romanizedName, input.nameLang ?? undefined);
  }
  if (input.familyName) {
    await store.sqliteAddName({
      entityId,
      text: input.familyName,
      nameType: 'family',
      origin: 'authority',
    });
  }
  if (input.givenName) {
    await store.sqliteAddName({
      entityId,
      text: input.givenName,
      nameType: 'given',
      origin: 'authority',
    });
  }
  if (input.kind === 'person') {
    await enrichPersonAuthority(store, entityId, input);
  } else if (input.kind === 'work' && (input.startYear != null || input.endYear != null)) {
    await store.sqliteSetUserWorkDate({
      entityId,
      startYear: input.startYear ?? null,
      endYear: input.endYear ?? null,
    });
  }
}

/** Mint a new entity via SQLite and apply basic authority enrich. */
export async function mintEntitySqlite(
  store: EntityStore,
  input: SqliteMintEntityInput,
): Promise<string> {
  await assertLookupSqliteStore(store);
  const id = mintEntityId(input.kind);
  const names: Array<{
    text: string;
    nameType: 'primary' | 'variant';
    language: string | null;
    isPrimary: boolean;
    origin: 'authority';
  }> = [
    {
      text: input.name,
      nameType: 'primary' as const,
      language: input.nameLang ?? null,
      isPrimary: true,
      origin: 'authority' as const,
    },
  ];
  if (input.romanizedName && input.romanizedName !== input.name) {
    names.push({
      text: input.romanizedName,
      nameType: 'variant',
      language: input.nameLang ? `${input.nameLang}-Latn` : 'und-Latn',
      isPrimary: false,
      origin: 'authority',
    });
  }
  await store.sqliteCreatePopulated({
    id,
    kind: input.kind,
    description: input.description ?? null,
    names,
    authorities: (input.authorityIds ?? []).map((a) => ({
      type: a.type,
      value: a.value,
      origin: 'authority' as const,
    })),
    familyName: input.familyName ?? null,
    givenName: input.givenName ?? null,
  });
  await enrichEntitySqlite(store, id, {
    kind: input.kind,
    startYear: input.startYear,
    endYear: input.endYear,
    nationality: input.nationality,
    authorityAssertions: input.authorityAssertions,
    authoritySource: input.authoritySource,
    origin: input.origin,
  });
  return id;
}

/**
 * Reuse an entity by local id or authority, or mint. Returns the PEDB entity id.
 */
export async function mintOrLinkEntitySqlite(
  store: EntityStore,
  input: SqliteMintEntityInput & { localEntityId?: string | null },
): Promise<{ id: string; created: boolean }> {
  await assertLookupSqliteStore(store);

  if (input.localEntityId) {
    const existing = await store.sqliteEntitySummary(input.localEntityId);
    if (existing) {
      await enrichEntitySqlite(store, input.localEntityId, input);
      return { id: input.localEntityId, created: false };
    }
  }

  for (const authority of input.authorityIds ?? []) {
    const match = await store.sqliteFindByAuthority(
      input.kind,
      authority.type,
      authority.value,
    );
    if (match) {
      await enrichEntitySqlite(store, match, input);
      return { id: match, created: false };
    }
  }

  const id = await mintEntitySqlite(store, input);
  return { id, created: true };
}
