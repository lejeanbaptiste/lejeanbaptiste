import {
  buildBridgeInbox,
  type BridgeInboxReport,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/bridgeInbox';
import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { promoteToCentral } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/promote';
import { applyReconcilePlan, planReconcile } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/reconcile';
import { readOrMintUserStableId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/userStableId';
import { findEntity } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';

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

/** Resolve both databases and the user id, or explain why the bridge is unavailable. */
export async function loadBridgeContext(): Promise<BridgeAvailability> {
  const api = desktopEntityFileApi();
  const projectStore = entityStoreFromDesktop();
  if (!api || !projectStore) return { available: false, reason: 'No project database is open.' };

  const centralFolder =
    (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
  const centralStore = centralEntityStoreFromDesktop(centralFolder);
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
  const [pedbDoc, cedbDoc] = await Promise.all([
    ctx.projectStore.loadEntities(),
    ctx.centralStore.loadEntities(),
  ]);
  return buildBridgeInbox(pedbDoc, cedbDoc, ctx.userStableId);
}

/** Promote the given project entity ids into the central database and link them. */
export async function promoteEntities(ctx: BridgeContext, pedbIds: string[]): Promise<number> {
  if (pedbIds.length === 0) return 0;
  const pedbDoc = await ctx.projectStore.loadEntities();
  const cedbDoc = await ctx.centralStore.loadEntities();
  let promoted = 0;
  for (const id of pedbIds) {
    if (!findEntity(pedbDoc, id)) continue;
    promoteToCentral(pedbDoc, id, cedbDoc, ctx.userStableId);
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
