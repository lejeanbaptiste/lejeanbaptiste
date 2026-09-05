import {
  buildBridgeInboxFromFields,
  type BridgeInboxReport,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/bridgeInbox';
import {
  applyCentralRemapToPedbSqlite,
  pendingCentralRemap,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/centralOrderSync';
import {
  pendingDeleteSuggestions,
  pendingMergeSuggestions,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/centralMergeSuggestions';
import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { composeRemap } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import type { EntityFields } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import {
  entityFieldsFromSqlitePanel,
  promoteToCentralSqlite,
  syncEntityPairSqlite,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteBridgeOps';
import {
  planReconcileFields,
  type FieldConflict,
  type ScalarField,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import { SQLITE_REQUIRED_MESSAGE } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteRequired';
import type { SqlitePanelSummaryLike } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteSummary';
import { readOrMintUserStableId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/userStableId';
import { type EntityKind } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { applyKeyRemapAcrossProjects } from './applyKeyRemap';

type PanelSnapshot = SqlitePanelSummaryLike & { updatedAt?: string };

const asPanelSnapshots = (rows: unknown[] | null): PanelSnapshot[] =>
  (rows ?? []) as PanelSnapshot[];

/**
 * Desktop wiring for the Bridge (Link/Promote/Sync between the project database
 * and the user's central database). Loads both stores plus the stable user id,
 * computes the inbox, and applies Promote/Sync. Never touches corpus keys.
 */

export interface BridgeContext {
  projectStore: EntityStore;
  centralStore: EntityStore;
  userStableId: string;
}

export interface BridgeConflictPair {
  pedbId: string;
  centralId: string;
  name: string;
  kind: EntityKind;
  conflicts: FieldConflict[];
}

export type BridgeAvailability =
  { available: true; context: BridgeContext } | { available: false; reason: string };

/**
 * Resolve both databases and the user id, or explain why the bridge is
 * unavailable. `overrideProjectRoot` lets a caller resolve the project store
 * before the project is loaded into the editor (see entityStoreFromDesktop).
 */
export async function loadBridgeContext(overrideProjectRoot?: string): Promise<BridgeAvailability> {
  const api = desktopEntityFileApi();
  const projectStore = entityStoreFromDesktop(
    overrideProjectRoot ? { projectRoot: overrideProjectRoot } : undefined,
  );
  if (!api || !projectStore) return { available: false, reason: 'No project database is open.' };

  const centralFolder = (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
  const centralStore = centralEntityStoreFromDesktop(centralFolder, overrideProjectRoot);
  if (!centralStore) {
    return { available: false, reason: 'No central database folder is configured (App Settings).' };
  }

  // When the project itself uses the central database there is nothing to bridge.
  const samePath =
    projectStore.entitiesPath.replace(/\\/g, '/').toLowerCase() ===
    centralStore.entitiesPath.replace(/\\/g, '/').toLowerCase();
  if (samePath) {
    return {
      available: false,
      reason: 'This project uses the central database directly — nothing to bridge.',
    };
  }

  const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
  return { available: true, context: { projectStore, centralStore, userStableId } };
}

/** Compute the current inbox from disk. Requires PEDB + CEDB SQLite. */
export async function computeBridgeInbox(ctx: BridgeContext): Promise<BridgeInboxReport> {
  if (
    !(await ctx.projectStore.hasSqliteDatabase()) ||
    !(await ctx.centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteListPanelSummaries ||
    !window.electronAPI?.entitySqliteGetCentralId
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  // PEDB is small (this project). CEDB can be tens of thousands of rows — never
  // dump the whole central panel list just to classify a handful of mappings.
  const [pedbRows, mappings] = await Promise.all([
    ctx.projectStore.sqlitePanelSummaries(),
    ctx.projectStore.sqliteListAllCentralMappings(ctx.userStableId),
  ]);
  const centralIdByProject = new Map(
    mappings.map((row) => [row.projectEntityId, row.centralId] as const),
  );

  const neededCentralIds = [
    ...new Set([...centralIdByProject.values()].filter((id): id is string => Boolean(id?.trim()))),
  ];
  const cedbFieldsById = new Map<string, EntityFields>();
  // Bounded parallelism: one IPC get per linked central id (typically ≪ CEDB size).
  const CONCURRENCY = 16;
  for (let i = 0; i < neededCentralIds.length; i += CONCURRENCY) {
    const chunk = neededCentralIds.slice(i, i + CONCURRENCY);
    const panels = await Promise.all(
      chunk.map(async (id) => {
        const panel = (await ctx.centralStore.sqliteEntitySummary(id)) as PanelSnapshot | null;
        return panel ? ([id, entityFieldsFromSqlitePanel(panel)] as const) : null;
      }),
    );
    for (const entry of panels) {
      if (entry) cedbFieldsById.set(entry[0], entry[1]);
    }
  }

  const pedbFieldRows = asPanelSnapshots(pedbRows).map((row) => {
    const activeName = row.names.find((name) => name.status === 'active');
    return {
      id: row.id,
      name: activeName?.text ?? row.id,
      kind: row.kind,
      centralId: centralIdByProject.get(row.id) ?? null,
      fields: entityFieldsFromSqlitePanel(row),
    };
  });
  return buildBridgeInboxFromFields(pedbFieldRows, cedbFieldsById);
}

/** Load just the disputed scalar fields for the focused Bridge resolver. */
export async function loadBridgeConflictPair(
  ctx: BridgeContext,
  pedbId: string,
  centralId: string,
): Promise<BridgeConflictPair | null> {
  const [pedb, central] = await Promise.all([
    ctx.projectStore.sqliteEntitySummary(pedbId),
    ctx.centralStore.sqliteEntitySummary(centralId),
  ]);
  if (!pedb || !central) return null;
  const project = pedb as PanelSnapshot;
  const centralRow = central as PanelSnapshot;
  const plan = planReconcileFields(
    entityFieldsFromSqlitePanel(project),
    entityFieldsFromSqlitePanel(centralRow),
  );
  const name = project.names.find((entry) => entry.status === 'active')?.text ?? pedbId;
  return { pedbId, centralId, name, kind: project.kind, conflicts: plan.conflicts };
}

export type BridgeConflictChoice = 'pedb' | 'cedb' | 'defer';

const applyConflictValue = async (
  store: EntityStore,
  entityId: string,
  kind: EntityKind,
  field: ScalarField,
  value: string | number,
) => {
  switch (field) {
    case 'description':
      await store.sqliteUpdateDescription(entityId, String(value));
      return;
    case 'familyName':
      await store.sqliteUpdateNames({ entityId, text: String(value), nameType: 'family' });
      return;
    case 'givenName':
      await store.sqliteUpdateNames({ entityId, text: String(value), nameType: 'given' });
      return;
    case 'startYear':
      if (kind === 'person')
        await store.sqliteSetUserDate({ entityId, part: 'birth', year: Number(value) });
      else if (kind === 'work') {
        const panel = (await store.sqliteEntitySummary(entityId)) as PanelSnapshot | null;
        await store.sqliteSetUserWorkDate({
          entityId,
          startYear: Number(value),
          endYear: panel?.endYear ?? null,
        });
      }
      return;
    case 'endYear':
      if (kind === 'person')
        await store.sqliteSetUserDate({ entityId, part: 'death', year: Number(value) });
      else if (kind === 'work') {
        const panel = (await store.sqliteEntitySummary(entityId)) as PanelSnapshot | null;
        await store.sqliteSetUserWorkDate({
          entityId,
          startYear: panel?.startYear ?? null,
          endYear: Number(value),
        });
      }
      return;
  }
};

/** Apply explicit scalar choices, then let ordinary Bridge sync propagate the non-conflicting fields. */
export async function resolveBridgeConflict(
  ctx: BridgeContext,
  pair: BridgeConflictPair,
  choices: Partial<Record<ScalarField, BridgeConflictChoice>>,
) {
  for (const conflict of pair.conflicts) {
    const choice = choices[conflict.field];
    if (!choice || choice === 'defer') continue;
    if (choice === 'pedb') {
      await applyConflictValue(
        ctx.centralStore,
        pair.centralId,
        pair.kind,
        conflict.field,
        conflict.pedbValue,
      );
    } else {
      await applyConflictValue(
        ctx.projectStore,
        pair.pedbId,
        pair.kind,
        conflict.field,
        conflict.cedbValue,
      );
    }
  }
  await syncEntityPairSqlite(ctx.projectStore, ctx.centralStore, pair.pedbId, pair.centralId);
}

export interface CentralOrderSyncSummary {
  /** Central-database orders newly applied to this project's mappings. */
  ordersApplied: number;
  /** Mappings repointed to a merge survivor. */
  repointed: number;
  /** Mappings cleared because the central entity was deleted outright. */
  cleared: number;
}

/**
 * Converge this project's `grognard-central` mappings against the central
 * database's own order log: any mapping naming an id that was merged or
 * deleted upstream gets repointed (or cleared) automatically. This is what
 * makes a central-database Absorb reach a linked PEDB even though the PEDB
 * is a different `entities.xml` with its own id space — the mapping is the
 * only bridge between the two, so it's the only thing that needs to move.
 * Idempotent and safe to call on every project open or Bridge-dialog visit.
 *
 * Remap writes and CEDB fingerprint both require SQLite; missing SQLite fails
 * loud (no DOM load/save).
 */
export async function applyPendingCentralOrders(
  ctx: BridgeContext,
): Promise<CentralOrderSyncSummary> {
  const none: CentralOrderSyncSummary = { ordersApplied: 0, repointed: 0, cleared: 0 };

  const [cedbOrders, applied] = await Promise.all([
    ctx.centralStore.readEntityOrders(),
    ctx.projectStore.readAppliedOrderIds(),
  ]);
  if (cedbOrders.length === 0) return none;

  if (
    !(await ctx.projectStore.hasSqliteDatabase()) ||
    !(await ctx.centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteClearCentralMapping ||
    !window.electronAPI?.entitySqliteDatabaseId
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  const cedbDbId = await ctx.centralStore.sqliteDatabaseId();
  if (!cedbDbId) return none;

  const { pending, remap } = pendingCentralRemap(cedbOrders, cedbDbId, applied);
  if (pending.length === 0) return none;

  const result = await applyCentralRemapToPedbSqlite(ctx.projectStore, remap, ctx.userStableId);

  for (const order of pending) applied.add(order.id);
  await ctx.projectStore.writeAppliedOrderIds(applied);

  return {
    ordersApplied: pending.length,
    repointed: result.repointed.length,
    cleared: result.cleared.length,
  };
}

/** Promote the given project entity ids into the central database and link them. */
export async function promoteEntities(ctx: BridgeContext, pedbIds: string[]): Promise<number> {
  if (pedbIds.length === 0) return 0;

  if (
    !(await ctx.projectStore.hasSqliteDatabase()) ||
    !(await ctx.centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteCreatePopulated ||
    !window.electronAPI?.entitySqliteSetCentralMapping
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  let promoted = 0;
  for (const id of pedbIds) {
    const result = await promoteToCentralSqlite(
      ctx.projectStore,
      ctx.centralStore,
      id,
      ctx.userStableId,
    );
    if (result) promoted += 1;
  }
  return promoted;
}

/**
 * Apply the non-conflicting reconciliation for the given mapped project ids,
 * converging both databases. Conflicting fields are left for the user.
 */
export async function syncEntities(
  ctx: BridgeContext,
  pairs: { pedbId: string; centralId: string }[],
): Promise<{ synced: number }> {
  if (pairs.length === 0) return { synced: 0 };

  if (
    !(await ctx.projectStore.hasSqliteDatabase()) ||
    !(await ctx.centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteAttachAuthority
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  let synced = 0;
  for (const { pedbId, centralId } of pairs) {
    const result = await syncEntityPairSqlite(
      ctx.projectStore,
      ctx.centralStore,
      pedbId,
      centralId,
    );
    if (result) synced += 1;
  }
  return { synced };
}

/**
 * For unsynchronized projects: Bridge-Sync every linked pair. Pulls new central
 * names (e.g. a courtesy name added from another project) and authorities into
 * the PEDB, and fills empty scalars both ways. Disagreeing scalars (two
 * different birth years, etc.) are left untouched for the Bridge inbox —
 * `syncEntityPairSqlite` never overwrites them.
 *
 * Safe to call on project open and Database Refresh — identical pairs are a
 * no-op. Synchronized projects should use `synchronizeMirroredProject` instead.
 */
export async function syncNonConflictingLinkedEntities(
  ctx: BridgeContext,
): Promise<{ synced: number }> {
  const inbox = await computeBridgeInbox(ctx);
  const pairs = [
    ...inbox.syncable.map((item) => ({ pedbId: item.id, centralId: item.centralId })),
    // Conflict pairs still get name/authority unions; only scalar disagreements
    // remain for the user.
    ...inbox.conflicts.map((item) => ({ pedbId: item.id, centralId: item.centralId })),
  ];
  if (pairs.length === 0) return { synced: 0 };
  return syncEntities(ctx, pairs);
}

/**
 * The merge docket: central-database merge and delete (purge) suggestions
 * still worth a decision (see `centralMergeSuggestions.ts`). Central-only —
 * unlike the Bridge inbox above, this doesn't need a project database at
 * all, since a suggestion can be raised by any project bridged to this
 * catalogue, on any machine. Call with whatever central store the database
 * panel is already holding, whether or not the current project happens to
 * bridge to it.
 */
export interface MergeDocketSide {
  id: string;
  kind: EntityKind;
  /** Names (by type), dates, description, and linked authorities for the comparison view. */
  fields: EntityFields;
}

export type MergeDocketEntry =
  | { kind: 'merge'; suggestionId: string; when: string; sides: [MergeDocketSide, MergeDocketSide] }
  | { kind: 'delete'; suggestionId: string; when: string; side: MergeDocketSide };

export async function computeMergeDocket(centralStore: EntityStore): Promise<MergeDocketEntry[]> {
  if (
    !(await centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteGet ||
    !window.electronAPI?.entitySqliteDatabaseId
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  const [suggestions, resolutions, cedbOrders, cedbDbId] = await Promise.all([
    centralStore.readMergeSuggestions(),
    centralStore.readMergeSuggestionResolutions(),
    centralStore.readEntityOrders(),
    centralStore.sqliteDatabaseId(),
  ]);
  if (!cedbDbId) return [];

  // CEDB can be tens of thousands of rows — only fetch panels named by still-
  // open suggestions (usually a handful), never dump the whole catalogue.
  // Resolve through the order log first so merge survivors are included.
  const resolvedSuggestionIds = new Set(resolutions.map((row) => row.suggestionId));
  const remap = composeRemap(cedbOrders.filter((order) => order.dbId === cedbDbId));
  const resolveId = (id: string): string | null => (id in remap ? remap[id]! : id);
  const candidateIds = new Set<string>();
  for (const suggestion of suggestions) {
    if (resolvedSuggestionIds.has(suggestion.id)) continue;
    if (suggestion.kind === 'delete') {
      const id = resolveId(suggestion.centralId);
      if (id) candidateIds.add(id);
      continue;
    }
    for (const raw of suggestion.centralIds ?? []) {
      const id = resolveId(raw);
      if (id) candidateIds.add(id);
    }
  }

  const byId = new Map<string, PanelSnapshot>();
  const CONCURRENCY = 16;
  const idList = [...candidateIds];
  for (let i = 0; i < idList.length; i += CONCURRENCY) {
    const chunk = idList.slice(i, i + CONCURRENCY);
    const panels = await Promise.all(
      chunk.map(async (id) => {
        const panel = (await centralStore.sqliteEntitySummary(id)) as PanelSnapshot | null;
        return panel ? ([id, panel] as const) : null;
      }),
    );
    for (const entry of panels) {
      if (entry) byId.set(entry[0], entry[1]);
    }
  }

  const existingIds = new Set(byId.keys());
  const entries: MergeDocketEntry[] = [];

  for (const item of pendingMergeSuggestions(
    suggestions,
    resolutions,
    cedbOrders,
    cedbDbId,
    existingIds,
  )) {
    const [aId, bId] = item.centralIds;
    const aRow = byId.get(aId);
    const bRow = byId.get(bId);
    if (!aRow || !bRow) continue;
    entries.push({
      kind: 'merge',
      suggestionId: item.id,
      when: item.when,
      sides: [
        { id: aId, kind: aRow.kind, fields: entityFieldsFromSqlitePanel(aRow) },
        { id: bId, kind: bRow.kind, fields: entityFieldsFromSqlitePanel(bRow) },
      ],
    });
  }

  for (const item of pendingDeleteSuggestions(
    suggestions,
    resolutions,
    cedbOrders,
    cedbDbId,
    existingIds,
  )) {
    const row = byId.get(item.centralId);
    if (!row) continue;
    entries.push({
      kind: 'delete',
      suggestionId: item.id,
      when: item.when,
      side: { id: item.centralId, kind: row.kind, fields: entityFieldsFromSqlitePanel(row) },
    });
  }

  entries.sort((a, b) => a.when.localeCompare(b.when));
  return entries;
}

export type MergeSuggestionDecision =
  | { action: 'ignore' }
  | { action: 'merge'; keepId: string; dropId: string }
  | { action: 'delete'; centralId: string };

/**
 * Act on a docket entry: record the suggestion as ignored (it never
 * resurfaces, but nothing else changes), merge the two central entities the
 * user confirmed are the same, or delete the central entity the user
 * confirmed is an orphan — see `centralMergeSuggestions.ts`. Both the merge
 * and the delete are ordinary central Absorb/delete operations: each records
 * a durable order (so every bridged PEDB converges its own `grognard-central`
 * mapping the next time it opens or visits its Bridge inbox) and eagerly
 * rewrites any project still using this file directly, exactly like a
 * manual central merge/delete from the database panel.
 *
 * Merge/delete require CEDB SQLite; missing SQLite fails loud (no DOM save).
 */
export async function resolveMergeSuggestion(
  centralStore: EntityStore,
  suggestionId: string,
  decision: MergeSuggestionDecision,
): Promise<void> {
  if (decision.action === 'ignore') {
    await centralStore.recordMergeSuggestionResolution(suggestionId, 'ignored');
    return;
  }

  if (
    !(await centralStore.hasSqliteDatabase()) ||
    !window.electronAPI?.entitySqliteSoftDelete ||
    !window.electronAPI?.entitySqliteMerge
  ) {
    throw new Error(SQLITE_REQUIRED_MESSAGE);
  }

  const dbId = (await centralStore.sqliteDatabaseId()) ?? undefined;
  if (decision.action === 'delete') {
    await centralStore.sqliteSoftDelete(decision.centralId);
    const remap = { [decision.centralId]: null };
    await centralStore.recordEntityOrder(remap, dbId);
    await applyKeyRemapAcrossProjects(centralStore, remap).catch(() => undefined);
    await centralStore.recordMergeSuggestionResolution(suggestionId, 'deleted');
    return;
  }

  const mergeResult = await centralStore.sqliteMerge(decision.keepId, [decision.dropId]);
  const remap = mergeResult.remap;
  if (Object.keys(remap).length > 0) {
    await centralStore.recordEntityOrder(remap, dbId);
    await applyKeyRemapAcrossProjects(centralStore, remap).catch(() => undefined);
  }
  await centralStore.recordMergeSuggestionResolution(suggestionId, 'merged');
}
