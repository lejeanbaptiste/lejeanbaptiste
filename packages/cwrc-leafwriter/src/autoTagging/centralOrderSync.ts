/**
 * Propagates central-database (CEDB) merge/delete orders down into a linked
 * project database's (PEDB) `ljb-central` concordance rows.
 *
 * When you Absorb a duplicate in the central database, the survivor's id
 * lives on; the merged-away id is gone. Any PEDB entity whose `ljb-central`
 * mapping named the merged-away id is now silently "broken" (see
 * `bridgeInbox.ts`) until something repoints it. This module is that
 * something: it reads the CEDB's own order log (the same durable log used
 * for same-database merge/delete propagation, see `entityOrders.ts`) and
 * repoints — or clears, for an outright delete with no survivor — the
 * matching mapping.
 *
 * Deliberately narrow: this only ever rewrites `<idno type="ljb-central">`
 * rows. Corpus `@key`s are never touched — central ids never appear there
 * (see `concordance.ts`), so there is nothing else to rewrite.
 */

import { clearCentralMapping, getCentralId, setCentralMapping } from './concordance';
import { findEntity } from './entities';
import { listEntities } from './entityOps';
import { composeRemap, pendingOrders, type EntityOrder } from './entityOrders';

export interface CentralOrderSyncItem {
  /** The PEDB entity's own id. */
  id: string;
  name: string;
  /** The central id the mapping used to name. */
  from: string;
  /** The surviving central id, or null when the central entity was deleted outright. */
  to: string | null;
}

export interface CentralOrderSyncResult {
  /** Mappings repointed to the surviving central id after an upstream merge. */
  repointed: CentralOrderSyncItem[];
  /** Mappings cleared because the central entity was deleted outright (no survivor). */
  cleared: CentralOrderSyncItem[];
}

const EMPTY_RESULT: CentralOrderSyncResult = { repointed: [], cleared: [] };

/**
 * Select the CEDB orders this project checkout hasn't applied yet, and fold
 * them into one composite remap (old central id → surviving id, or `null` for
 * an outright delete). Chains resolve the same way same-database replay does
 * (see `composeRemap`), so a merge-then-merge-again converges in one pass.
 */
export function pendingCentralRemap(
  cedbOrders: EntityOrder[],
  cedbDbId: string,
  applied: Set<string>,
): { pending: EntityOrder[]; remap: Record<string, string | null> } {
  const pending = pendingOrders(cedbOrders, cedbDbId, applied);
  return { pending, remap: pending.length > 0 ? composeRemap(pending) : {} };
}

/**
 * Repoint or clear this user's `ljb-central` mapping on every PEDB entity
 * whose mapped central id was merged or deleted upstream. Pure DOM mutation;
 * the caller decides whether/when to save.
 */
export function applyCentralRemapToPedb(
  pedbDoc: Document,
  remap: Record<string, string | null>,
  userStableId: string,
): CentralOrderSyncResult {
  if (Object.keys(remap).length === 0) return EMPTY_RESULT;

  const result: CentralOrderSyncResult = { repointed: [], cleared: [] };
  for (const entity of listEntities(pedbDoc)) {
    const item = findEntity(pedbDoc, entity.id);
    if (!item) continue;
    const centralId = getCentralId(item, userStableId);
    if (!centralId || !(centralId in remap)) continue;

    const target = remap[centralId] ?? null;
    const name = entity.names[0] ?? entity.id;
    if (target && target !== centralId) {
      setCentralMapping(item, userStableId, target);
      result.repointed.push({ id: entity.id, name, from: centralId, to: target });
    } else if (!target) {
      clearCentralMapping(item, userStableId);
      result.cleared.push({ id: entity.id, name, from: centralId, to: null });
    }
  }
  return result;
}
