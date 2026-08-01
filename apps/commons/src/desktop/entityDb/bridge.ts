import {
  buildBridgeInbox,
  buildBridgeInboxFromFields,
  type BridgeInboxReport,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/bridgeInbox';
import {
  applyCentralRemapToPedb,
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
import { deleteEntity, kindOfElement, mergeEntities } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import { buildCentralPromotionIndex, promoteToCentral } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/promote';
import {
  applyReconcilePlan,
  planReconcile,
  readFields,
  type EntityFields,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import {
  entityFieldsFromSqlitePanel,
  promoteToCentralSqlite,
  syncEntityPairSqlite,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteBridgeOps';
import type { SqlitePanelSummaryLike } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteSummary';
import { readOrMintUserStableId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/userStableId';
import {
  ENTITY_KINDS,
  entityElements,
  findEntity,
  getDatabaseId,
  type EntityKind,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { applyKeyRemapAcrossProjects } from './applyKeyRemap';

/** Every entity element in a document, across all kinds. */
const allEntityElements = (doc: Document): Element[] =>
  (Object.keys(ENTITY_KINDS) as EntityKind[]).flatMap((kind) => entityElements(doc, kind));

const entityIdsFromDoc = (doc: Document): Set<string> =>
  new Set(
    allEntityElements(doc)
      .map((item) => item.getAttribute('xml:id'))
      .filter((id): id is string => Boolean(id)),
  );

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

export type BridgeAvailability =
  | { available: true; context: BridgeContext }
  | { available: false; reason: string };

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

  const centralFolder =
    (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
  const centralStore = centralEntityStoreFromDesktop(centralFolder, overrideProjectRoot);
  if (!centralStore) {
    return { available: false, reason: 'No central database folder is configured (App Settings).' };
  }

  // When the project itself uses the central database there is nothing to bridge.
  const samePath =
    projectStore.entitiesPath.replace(/\\/g, '/').toLowerCase() ===
    centralStore.entitiesPath.replace(/\\/g, '/').toLowerCase();
  if (samePath) {
    return { available: false, reason: 'This project uses the central database directly — nothing to bridge.' };
  }

  const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
  return { available: true, context: { projectStore, centralStore, userStableId } };
}

/** Compute the current inbox from disk. */
export async function computeBridgeInbox(ctx: BridgeContext): Promise<BridgeInboxReport> {
  if (
    (await ctx.projectStore.hasSqliteDatabase()) &&
    (await ctx.centralStore.hasSqliteDatabase()) &&
    window.electronAPI?.entitySqliteListPanelSummaries &&
    window.electronAPI?.entitySqliteGetCentralId
  ) {
    const [pedbRows, cedbRows] = await Promise.all([
      ctx.projectStore.sqlitePanelSummaries(),
      ctx.centralStore.sqlitePanelSummaries(),
    ]);
    const cedbFieldsById = new Map<string, EntityFields>();
    for (const row of asPanelSnapshots(cedbRows)) {
      cedbFieldsById.set(row.id, entityFieldsFromSqlitePanel(row));
    }
    const pedbFieldRows = [];
    for (const row of asPanelSnapshots(pedbRows)) {
      const centralId = await ctx.projectStore.sqliteGetCentralId(row.id, ctx.userStableId);
      const activeName = row.names.find((name) => name.status === 'active');
      pedbFieldRows.push({
        id: row.id,
        name: activeName?.text ?? row.id,
        kind: row.kind,
        centralId,
        fields: entityFieldsFromSqlitePanel(row),
      });
    }
    return buildBridgeInboxFromFields(pedbFieldRows, cedbFieldsById);
  }

  const [pedbDoc, cedbDoc] = await Promise.all([
    ctx.projectStore.loadEntities(),
    ctx.centralStore.loadEntities(),
  ]);
  return buildBridgeInbox(pedbDoc, cedbDoc, ctx.userStableId);
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
 * Converge this project's `ljb-central` mappings against the central
 * database's own order log: any mapping naming an id that was merged or
 * deleted upstream gets repointed (or cleared) automatically. This is what
 * makes a central-database Absorb reach a linked PEDB even though the PEDB
 * is a different `entities.xml` with its own id space — the mapping is the
 * only bridge between the two, so it's the only thing that needs to move.
 * Idempotent and safe to call on every project open or Bridge-dialog visit.
 */
export async function applyPendingCentralOrders(
  ctx: BridgeContext,
): Promise<CentralOrderSyncSummary> {
  const none: CentralOrderSyncSummary = { ordersApplied: 0, repointed: 0, cleared: 0 };

  const [cedbOrders, applied] = await Promise.all([
    ctx.centralStore.readEntityOrders(),
    ctx.projectStore.readAppliedOrderIds(),
  ]);

  const useSqlite =
    (await ctx.projectStore.hasSqliteDatabase()) &&
    Boolean(window.electronAPI?.entitySqliteClearCentralMapping);

  let cedbDbId: string | null = null;
  if (useSqlite) {
    cedbDbId = await ctx.centralStore.sqliteDatabaseId();
  } else {
    const cedbDoc = await ctx.centralStore.loadEntities();
    cedbDbId = getDatabaseId(cedbDoc);
  }
  if (!cedbDbId) return none;

  const { pending, remap } = pendingCentralRemap(cedbOrders, cedbDbId, applied);
  if (pending.length === 0) return none;

  let result;
  if (useSqlite) {
    result = await applyCentralRemapToPedbSqlite(ctx.projectStore, remap, ctx.userStableId);
  } else {
    const pedbDoc = await ctx.projectStore.loadEntities();
    result = applyCentralRemapToPedb(pedbDoc, remap, ctx.userStableId);
    if (result.repointed.length > 0 || result.cleared.length > 0) {
      await ctx.projectStore.saveEntities(pedbDoc);
    }
  }

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
    (await ctx.projectStore.hasSqliteDatabase()) &&
    (await ctx.centralStore.hasSqliteDatabase()) &&
    window.electronAPI?.entitySqliteCreatePopulated &&
    window.electronAPI?.entitySqliteSetCentralMapping
  ) {
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

  const pedbDoc = await ctx.projectStore.loadEntities();
  const cedbDoc = await ctx.centralStore.loadEntities();
  // Built once and kept current by promoteToCentral — without these, every
  // call re-scans the whole project doc for its id and re-scans the (steadily
  // growing) central doc for duplicates, which is O(n²) across a batch of
  // hundreds or thousands of ids (e.g. "Accept all" on a bulk-import review).
  const pedbIndex = new Map(
    allEntityElements(pedbDoc)
      .map((item): [string, Element] | null => {
        const id = item.getAttribute('xml:id');
        return id ? [id, item] : null;
      })
      .filter((entry): entry is [string, Element] => entry !== null),
  );
  const centralIndex = buildCentralPromotionIndex(cedbDoc);
  let promoted = 0;
  for (const id of pedbIds) {
    if (!findEntity(pedbDoc, id, pedbIndex)) continue;
    promoteToCentral(pedbDoc, id, cedbDoc, ctx.userStableId, pedbIndex, centralIndex);
    promoted += 1;
  }
  await ctx.centralStore.saveEntities(cedbDoc);
  await ctx.projectStore.saveEntities(pedbDoc);
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
    (await ctx.projectStore.hasSqliteDatabase()) &&
    (await ctx.centralStore.hasSqliteDatabase()) &&
    window.electronAPI?.entitySqliteAttachAuthority
  ) {
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

  const pedbDoc = await ctx.projectStore.loadEntities();
  const cedbDoc = await ctx.centralStore.loadEntities();
  let synced = 0;
  let pedbTouched = false;
  let cedbTouched = false;
  for (const { pedbId, centralId } of pairs) {
    const pedbItem = findEntity(pedbDoc, pedbId);
    const cedbItem = findEntity(cedbDoc, centralId);
    if (!pedbItem || !cedbItem) continue;
    const plan = planReconcile(pedbItem, cedbItem);
    const { pedbChanged, cedbChanged } = applyReconcilePlan(pedbDoc, pedbId, cedbDoc, centralId, plan);
    pedbTouched ||= pedbChanged;
    cedbTouched ||= cedbChanged;
    synced += 1;
  }
  if (cedbTouched) await ctx.centralStore.saveEntities(cedbDoc);
  if (pedbTouched) await ctx.projectStore.saveEntities(pedbDoc);
  return { synced };
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

export async function computeMergeDocket(
  centralStore: EntityStore,
  /** Pass an already-loaded central doc (e.g. from a sibling load) to skip re-parsing it. */
  preloadedDoc?: Document,
): Promise<MergeDocketEntry[]> {
  const useSqlite =
    !preloadedDoc &&
    (await centralStore.hasSqliteDatabase()) &&
    Boolean(window.electronAPI?.entitySqliteListPanelSummaries);

  if (useSqlite) {
    const [suggestions, resolutions, cedbOrders, cedbDbId, summaries] = await Promise.all([
      centralStore.readMergeSuggestions(),
      centralStore.readMergeSuggestionResolutions(),
      centralStore.readEntityOrders(),
      centralStore.sqliteDatabaseId(),
      centralStore.sqlitePanelSummaries(),
    ]);
    if (!cedbDbId) return [];

    const snapshots = asPanelSnapshots(summaries);
    const byId = new Map(snapshots.map((row) => [row.id, row]));
    const existingIds = new Set(byId.keys());
    const entries: MergeDocketEntry[] = [];

    const pendingMerges = pendingMergeSuggestions(
      suggestions,
      resolutions,
      cedbOrders,
      cedbDbId,
      existingIds,
    );
    for (const item of pendingMerges) {
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

    const pendingDeletes = pendingDeleteSuggestions(
      suggestions,
      resolutions,
      cedbOrders,
      cedbDbId,
      existingIds,
    );
    for (const item of pendingDeletes) {
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

  const [cedbDoc, suggestions, resolutions, cedbOrders] = await Promise.all([
    preloadedDoc ?? centralStore.loadEntities(),
    centralStore.readMergeSuggestions(),
    centralStore.readMergeSuggestionResolutions(),
    centralStore.readEntityOrders(),
  ]);
  const cedbDbId = getDatabaseId(cedbDoc);
  if (!cedbDbId) return [];

  const existingIds = entityIdsFromDoc(cedbDoc);
  const entries: MergeDocketEntry[] = [];

  const pendingMerges = pendingMergeSuggestions(
    suggestions,
    resolutions,
    cedbOrders,
    cedbDbId,
    existingIds,
  );
  for (const item of pendingMerges) {
    const [aId, bId] = item.centralIds;
    const aItem = findEntity(cedbDoc, aId);
    const bItem = findEntity(cedbDoc, bId);
    const aKind = aItem && kindOfElement(aItem);
    const bKind = bItem && kindOfElement(bItem);
    if (!aItem || !bItem || !aKind || !bKind) continue;
    entries.push({
      kind: 'merge',
      suggestionId: item.id,
      when: item.when,
      sides: [
        { id: aId, kind: aKind, fields: readFields(aItem) },
        { id: bId, kind: bKind, fields: readFields(bItem) },
      ],
    });
  }

  const pendingDeletes = pendingDeleteSuggestions(
    suggestions,
    resolutions,
    cedbOrders,
    cedbDbId,
    existingIds,
  );
  for (const item of pendingDeletes) {
    const centralItem = findEntity(cedbDoc, item.centralId);
    const centralKind = centralItem && kindOfElement(centralItem);
    if (!centralItem || !centralKind) continue;
    entries.push({
      kind: 'delete',
      suggestionId: item.id,
      when: item.when,
      side: { id: item.centralId, kind: centralKind, fields: readFields(centralItem) },
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
 * a durable order (so every bridged PEDB converges its own `ljb-central`
 * mapping the next time it opens or visits its Bridge inbox) and eagerly
 * rewrites any project still using this file directly, exactly like a
 * manual central merge/delete from the database panel.
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
    (await centralStore.hasSqliteDatabase()) &&
    window.electronAPI?.entitySqliteSoftDelete &&
    window.electronAPI?.entitySqliteMerge
  ) {
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
    return;
  }

  const cedbDoc = await centralStore.loadEntities();
  const dbId = getDatabaseId(cedbDoc) ?? undefined;

  if (decision.action === 'delete') {
    deleteEntity(cedbDoc, decision.centralId);
    await centralStore.saveEntities(cedbDoc);
    const remap = { [decision.centralId]: null };
    await centralStore.recordEntityOrder(remap, dbId);
    await applyKeyRemapAcrossProjects(centralStore, remap).catch(() => undefined);
    await centralStore.recordMergeSuggestionResolution(suggestionId, 'deleted');
    return;
  }

  const { remap } = mergeEntities(cedbDoc, decision.keepId, [decision.dropId]);
  await centralStore.saveEntities(cedbDoc);
  if (Object.keys(remap).length > 0) {
    await centralStore.recordEntityOrder(remap, dbId);
    await applyKeyRemapAcrossProjects(centralStore, remap).catch(() => undefined);
  }
  await centralStore.recordMergeSuggestionResolution(suggestionId, 'merged');
}
