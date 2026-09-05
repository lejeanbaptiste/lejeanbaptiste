/**
 * SQLite-native Bridge promote/sync — promote, adopt, and pair sync without
 * exporting the whole entity database to XML.
 */

import { mintEntityId, type EntityKind } from './entities';
import { normalizeNameType } from './nameTypes';
import type { AdoptResult, PromoteResult } from './bridgeTypes';
import {
  planReconcileFields,
  type EntityFields,
  type NameField,
  type ReconcilePlan,
  type ScalarField,
} from './reconcile';
import type { EntityStore } from './entityStore';
import type { SqlitePanelSummaryLike } from './sqliteSummary';

type PanelSnapshot = SqlitePanelSummaryLike & {
  updatedAt?: string;
  assertions?: {
    key: string;
    element: string;
    value: string;
    status: 'active' | 'rejected' | 'withdrawn';
    noteType?: string | null;
  }[];
};

const panelFields = (snapshot: PanelSnapshot): EntityFields => ({
  names: snapshot.names
    .filter((name) => name.status === 'active')
    .filter((name) => name.nameType !== 'family' && name.nameType !== 'given')
    .map((name) => ({
      text: name.text,
      lang: name.language,
      type: name.nameType,
    })),
  authorities: snapshot.authorities.filter((a) => a.type !== 'grognard-central'),
  description: snapshot.description,
  familyName: snapshot.familyName,
  givenName: snapshot.givenName,
  startYear: snapshot.startYear,
  endYear: snapshot.endYear,
  changed: snapshot.updatedAt ?? null,
});

/** Map a SQLite panel snapshot into the reconcile `EntityFields` shape. */
export function entityFieldsFromSqlitePanel(snapshot: PanelSnapshot): EntityFields {
  return panelFields(snapshot);
}

async function loadPanel(store: EntityStore, entityId: string): Promise<PanelSnapshot | null> {
  const raw = await store.sqliteEntitySummary(entityId);
  return (raw as PanelSnapshot | null) ?? null;
}

export async function promoteToCentralSqlite(
  projectStore: EntityStore,
  centralStore: EntityStore,
  pedbId: string,
  userStableId: string,
): Promise<PromoteResult | null> {
  const pedb = await loadPanel(projectStore, pedbId);
  if (!pedb) return null;

  const existingMapping = await projectStore.sqliteGetCentralId(pedbId, userStableId);
  if (existingMapping) {
    const central = await loadPanel(centralStore, existingMapping);
    if (central) {
      return { centralId: existingMapping, created: false, linked: false };
    }
  }

  const fields = panelFields(pedb);
  const primary = fields.names[0];
  if (!primary) throw new Error(`promote: entity has no name: ${pedbId}`);

  let match: string | null = null;
  for (const authority of fields.authorities) {
    match = await centralStore.sqliteFindByAuthority(pedb.kind, authority.type, authority.value);
    if (match) break;
  }
  if (!match) {
    match = await centralStore.sqliteFindByNameDates(
      pedb.kind,
      primary.text,
      fields.startYear,
      fields.endYear,
    );
  }
  if (match) {
    const linked = await projectStore.sqliteSetCentralMapping(pedbId, userStableId, match);
    return { centralId: match, created: false, linked };
  }

  const centralId = mintEntityId(pedb.kind as EntityKind);
  const altNames = fields.names.slice(1).map((name) => ({
    text: name.text,
    nameType: name.type,
    language: name.lang,
    isPrimary: false,
    origin: 'xml' as const,
  }));
  await centralStore.sqliteCreatePopulated({
    id: centralId,
    kind: pedb.kind,
    description: fields.description,
    names: [
      {
        text: primary.text,
        nameType: primary.type ?? 'primary',
        language: primary.lang,
        isPrimary: true,
        origin: 'xml',
      },
      ...altNames,
    ],
    authorities: fields.authorities.map((a) => ({
      type: a.type,
      value: a.value,
      origin: 'xml' as const,
    })),
    familyName: fields.familyName,
    givenName: fields.givenName,
  });

  if (pedb.kind === 'person') {
    if (fields.startYear != null) {
      await centralStore.sqliteSetUserDate({
        entityId: centralId,
        part: 'birth',
        year: fields.startYear,
      });
    }
    if (fields.endYear != null) {
      await centralStore.sqliteSetUserDate({
        entityId: centralId,
        part: 'death',
        year: fields.endYear,
      });
    }
  } else if (pedb.kind === 'work' && (fields.startYear != null || fields.endYear != null)) {
    await centralStore.sqliteSetUserWorkDate({
      entityId: centralId,
      startYear: fields.startYear,
      endYear: fields.endYear,
    });
  }

  const linked = await projectStore.sqliteSetCentralMapping(pedbId, userStableId, centralId);
  return { centralId, created: true, linked };
}

/**
 * Reverse of {@link promoteToCentralSqlite}: ensure `centralId` has a linked
 * PEDB mirror for `userStableId`. Idempotent when a mapping already exists.
 */
export async function adoptFromCentralSqlite(
  projectStore: EntityStore,
  centralStore: EntityStore,
  centralId: string,
  userStableId: string,
): Promise<AdoptResult | null> {
  const cedb = await loadPanel(centralStore, centralId);
  if (!cedb) return null;

  const existing = await projectStore.sqliteListMappingsByCentralIds(userStableId, [centralId]);
  const mapped = existing.find((row) => row.centralId === centralId);
  if (mapped) {
    const pedb = await loadPanel(projectStore, mapped.projectEntityId);
    if (pedb) return { pedbId: mapped.projectEntityId, created: false };
  }

  const fields = panelFields(cedb);
  const primary = fields.names[0];
  if (!primary) throw new Error(`adopt: central entity has no name: ${centralId}`);

  let match: string | null = null;
  for (const authority of fields.authorities) {
    match = await projectStore.sqliteFindByAuthority(cedb.kind, authority.type, authority.value);
    if (match) break;
  }
  if (!match) {
    match = await projectStore.sqliteFindByNameDates(
      cedb.kind,
      primary.text,
      fields.startYear,
      fields.endYear,
    );
  }
  if (match) {
    await projectStore.sqliteSetCentralMapping(match, userStableId, centralId);
    return { pedbId: match, created: false };
  }

  const pedbId = mintEntityId(cedb.kind as EntityKind);
  const altNames = fields.names.slice(1).map((name) => ({
    text: name.text,
    nameType: name.type,
    language: name.lang,
    isPrimary: false,
    origin: 'xml' as const,
  }));
  await projectStore.sqliteCreatePopulated({
    id: pedbId,
    kind: cedb.kind,
    description: fields.description,
    names: [
      {
        text: primary.text,
        nameType: primary.type ?? 'primary',
        language: primary.lang,
        isPrimary: true,
        origin: 'xml',
      },
      ...altNames,
    ],
    authorities: fields.authorities.map((a) => ({
      type: a.type,
      value: a.value,
      origin: 'xml' as const,
    })),
    familyName: fields.familyName,
    givenName: fields.givenName,
  });

  if (cedb.kind === 'person') {
    if (fields.startYear != null) {
      await projectStore.sqliteSetUserDate({
        entityId: pedbId,
        part: 'birth',
        year: fields.startYear,
      });
    }
    if (fields.endYear != null) {
      await projectStore.sqliteSetUserDate({
        entityId: pedbId,
        part: 'death',
        year: fields.endYear,
      });
    }
  } else if (cedb.kind === 'work' && (fields.startYear != null || fields.endYear != null)) {
    await projectStore.sqliteSetUserWorkDate({
      entityId: pedbId,
      startYear: fields.startYear,
      endYear: fields.endYear,
    });
  }

  await projectStore.sqliteSetCentralMapping(pedbId, userStableId, centralId);
  return { pedbId, created: true };
}

const nameAttrs = (name: NameField) => ({
  nameType: normalizeNameType(name.type) ?? null,
  language: name.lang,
});

async function applyScalar(
  store: EntityStore,
  entityId: string,
  kind: EntityKind,
  field: ScalarField,
  value: string | number,
): Promise<void> {
  switch (field) {
    case 'description':
      await store.sqliteUpdateDescription(entityId, String(value));
      break;
    case 'familyName':
      await store.sqliteAddName({
        entityId,
        text: String(value),
        nameType: 'family',
        origin: 'xml',
      });
      break;
    case 'givenName':
      await store.sqliteAddName({
        entityId,
        text: String(value),
        nameType: 'given',
        origin: 'xml',
      });
      break;
    case 'startYear':
      if (kind === 'person') {
        await store.sqliteSetUserDate({ entityId, part: 'birth', year: Number(value) });
      } else if (kind === 'work') {
        const panel = await loadPanel(store, entityId);
        await store.sqliteSetUserWorkDate({
          entityId,
          startYear: Number(value),
          endYear: panel?.endYear ?? null,
        });
      }
      break;
    case 'endYear':
      if (kind === 'person') {
        await store.sqliteSetUserDate({ entityId, part: 'death', year: Number(value) });
      } else if (kind === 'work') {
        const panel = await loadPanel(store, entityId);
        await store.sqliteSetUserWorkDate({
          entityId,
          startYear: panel?.startYear ?? null,
          endYear: Number(value),
        });
      }
      break;
  }
}

async function propagateTombstonesSqlite(
  sourceStore: EntityStore,
  sourceId: string,
  targetStore: EntityStore,
  targetId: string,
): Promise<boolean> {
  const source = await loadPanel(sourceStore, sourceId);
  const target = await loadPanel(targetStore, targetId);
  if (!source?.assertions || !target?.assertions) return false;
  const rejected = source.assertions.filter((a) => a.status === 'rejected');
  if (rejected.length === 0) return false;
  let changed = false;
  for (const tombstone of rejected) {
    const match = target.assertions.find(
      (assertion) =>
        assertion.status === 'active' &&
        assertion.element === tombstone.element &&
        assertion.value === tombstone.value,
    );
    if (!match) continue;
    if (await targetStore.sqliteForceRejectAssertion(targetId, match.key)) changed = true;
  }
  return changed;
}

/** One-way tombstone push used by auto-sync after promote (PEDB → CEDB). */
export async function propagateTombstonesToSqlite(
  sourceStore: EntityStore,
  sourceId: string,
  targetStore: EntityStore,
  targetId: string,
): Promise<boolean> {
  return propagateTombstonesSqlite(sourceStore, sourceId, targetStore, targetId);
}

async function applyPlanToSide(
  store: EntityStore,
  entityId: string,
  kind: EntityKind,
  addNames: NameField[],
  addAuthorities: { type: string; value: string }[],
  fill: Partial<Record<ScalarField, string | number>>,
): Promise<boolean> {
  let changed = false;
  for (const name of addNames) {
    await store.sqliteAddName({
      entityId,
      text: name.text,
      ...nameAttrs(name),
      isPrimary: false,
      origin: 'xml',
    });
    changed = true;
  }
  for (const auth of addAuthorities) {
    if (await store.sqliteAttachAuthority(entityId, auth.type, auth.value)) changed = true;
  }
  for (const [field, value] of Object.entries(fill)) {
    await applyScalar(store, entityId, kind, field as ScalarField, value!);
    changed = true;
  }
  return changed;
}

export async function syncEntityPairSqlite(
  projectStore: EntityStore,
  centralStore: EntityStore,
  pedbId: string,
  centralId: string,
): Promise<{ pedbChanged: boolean; cedbChanged: boolean } | null> {
  const pedb = await loadPanel(projectStore, pedbId);
  const cedb = await loadPanel(centralStore, centralId);
  if (!pedb || !cedb) return null;

  let pedbChanged = await propagateTombstonesSqlite(centralStore, centralId, projectStore, pedbId);
  let cedbChanged = await propagateTombstonesSqlite(projectStore, pedbId, centralStore, centralId);

  // Re-read after tombstones so the union plan does not revive them.
  const pedbAfter = (await loadPanel(projectStore, pedbId)) ?? pedb;
  const cedbAfter = (await loadPanel(centralStore, centralId)) ?? cedb;
  const plan: ReconcilePlan = planReconcileFields(panelFields(pedbAfter), panelFields(cedbAfter));

  pedbChanged =
    (await applyPlanToSide(
      projectStore,
      pedbId,
      pedb.kind,
      plan.addNamesToPedb,
      plan.addAuthoritiesToPedb,
      plan.fillPedb,
    )) || pedbChanged;
  cedbChanged =
    (await applyPlanToSide(
      centralStore,
      centralId,
      cedb.kind,
      plan.addNamesToCedb,
      plan.addAuthoritiesToCedb,
      plan.fillCedb,
    )) || cedbChanged;

  return { pedbChanged, cedbChanged };
}
