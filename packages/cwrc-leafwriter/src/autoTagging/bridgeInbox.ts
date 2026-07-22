/**
 * The Bridge inbox model: a per-user snapshot of how well this project's
 * database (PEDB) is linked to the user's central database (CEDB), so the UI can
 * show "N unlinked · N broken · N conflicts" and offer Promote / re-link / Sync.
 *
 * Pure: given both documents and the user's stable id, classify every project
 * entity. No file IO, no corpus keys touched.
 */

import { getCentralId } from './concordance';
import { findEntity, type EntityKind } from './entities';
import { listEntities } from './entityOps';
import { planReconcile, type ScalarField } from './reconcile';

export interface BridgeItem {
  id: string;
  name: string;
  kind: EntityKind;
}

export interface BrokenItem extends BridgeItem {
  /** The central id the mapping names, which is missing from the central DB. */
  centralId: string;
}

export interface ConflictItem extends BridgeItem {
  centralId: string;
  /** Scalar fields that disagree between the two records. */
  fields: ScalarField[];
}

export interface SyncableItem extends BridgeItem {
  centralId: string;
}

export interface BridgeInboxReport {
  /** Project entities with no central mapping for this user (Promote candidates). */
  unlinked: BridgeItem[];
  /** Mappings that point at a central id no longer present (re-link candidates). */
  broken: BrokenItem[];
  /** Mapped pairs with non-conflicting differences to propagate (Sync candidates). */
  syncable: SyncableItem[];
  /** Mapped pairs whose records disagree on a scalar field (need a decision). */
  conflicts: ConflictItem[];
  /** Mapped pairs that already fully agree (nothing to do). */
  inSyncCount: number;
}

/** Build the Bridge inbox for one user from the two databases. */
export function buildBridgeInbox(
  pedbDoc: Document,
  cedbDoc: Document,
  userStableId: string,
): BridgeInboxReport {
  const report: BridgeInboxReport = {
    unlinked: [],
    broken: [],
    syncable: [],
    conflicts: [],
    inSyncCount: 0,
  };

  for (const entity of listEntities(pedbDoc)) {
    const pedbItem = findEntity(pedbDoc, entity.id);
    if (!pedbItem) continue;
    const base: BridgeItem = { id: entity.id, name: entity.names[0] ?? entity.id, kind: entity.kind };

    const centralId = getCentralId(pedbItem, userStableId);
    if (!centralId) {
      report.unlinked.push(base);
      continue;
    }

    const cedbItem = findEntity(cedbDoc, centralId);
    if (!cedbItem) {
      report.broken.push({ ...base, centralId });
      continue;
    }

    const plan = planReconcile(pedbItem, cedbItem);
    if (plan.conflicts.length > 0) {
      report.conflicts.push({ ...base, centralId, fields: plan.conflicts.map((c) => c.field) });
    } else if (plan.identical) {
      report.inSyncCount += 1;
    } else {
      report.syncable.push({ ...base, centralId });
    }
  }

  return report;
}

/** Total items that need attention (drives the toolbar badge). */
export function bridgeAttentionCount(report: BridgeInboxReport): number {
  return report.unlinked.length + report.broken.length + report.conflicts.length;
}
