/**
 * Unison-style merge of two forked copies of the *same* central database
 * (Story F: cloud sync raced, or the folder was copied to a second machine and
 * both were edited). Both forks share one UUID id space, so entities match by
 * `xml:id`:
 *
 *   - id only in the other fork → **import** it (additions union).
 *   - id in both, records identical → nothing (touch the older timestamp up).
 *   - id in both, non-conflicting differences → auto-union via the same
 *     field-level reconcile the bridge uses.
 *   - id in both, same field disagrees → **conflict**: reported for the user,
 *     or resolved to the newer side with `keepNewest` ("keep all more recent").
 *
 * Absence is deliberately NOT treated as deletion — a record missing from one
 * fork is indistinguishable from one *added* on the other. Deletions propagate
 * only through the order log (`entityOrders.ts`); merge its two copies with
 * `unionOrderLogs` alongside this document merge.
 */

import {
  ENTITY_KINDS,
  entityElements,
  findEntity,
  getEntityList,
  getEntityChanged,
  touchEntity,
  type EntityKind,
} from './entities';
import {
  applyReconcilePlan,
  planReconcile,
  setEntityScalar,
  type FieldConflict,
} from './reconcile';

export interface ForkMergeConflict extends FieldConflict {
  /** Entity id the conflict sits on. */
  id: string;
}

export interface ForkMergeResult {
  /** Entities that existed only in the other fork and were imported. */
  imported: number;
  /** Entities whose non-conflicting differences were unioned. */
  reconciled: number;
  /** Unresolved same-field disagreements (empty when `keepNewest` resolved all). */
  conflicts: ForkMergeConflict[];
  changed: boolean;
}

/**
 * Merge `fromDoc` (the other fork) into `intoDoc`. `intoDoc` becomes the merged
 * database; `fromDoc` is scratch and should be discarded afterwards.
 */
export function mergeForkedCentral(
  intoDoc: Document,
  fromDoc: Document,
  options?: { keepNewest?: boolean },
): ForkMergeResult {
  const result: ForkMergeResult = { imported: 0, reconciled: 0, conflicts: [], changed: false };

  for (const kind of Object.keys(ENTITY_KINDS) as EntityKind[]) {
    for (const fromItem of entityElements(fromDoc, kind)) {
      const id = fromItem.getAttribute('xml:id');
      if (!id) continue;

      const intoItem = findEntity(intoDoc, id);
      if (!intoItem) {
        getEntityList(intoDoc, kind).appendChild(intoDoc.importNode(fromItem, true));
        result.imported += 1;
        result.changed = true;
        continue;
      }

      // "pedb" side = intoDoc, "cedb" side = fromDoc; fromDoc mutations are
      // harmless scratch. Union names/authorities, fill empty scalars.
      const plan = planReconcile(intoItem, fromItem);

      if (plan.identical) {
        // Same content, older timestamp on our side → adopt the newer stamp so
        // a later three-way sync doesn't see phantom staleness.
        const fromChanged = getEntityChanged(fromItem);
        if (plan.newer === 'cedb' && fromChanged) {
          touchEntity(intoItem, fromChanged);
          result.changed = true;
        }
        continue;
      }

      const { pedbChanged } = applyReconcilePlan(intoDoc, id, fromDoc, id, plan);
      if (pedbChanged) {
        result.reconciled += 1;
        result.changed = true;
      }

      for (const conflict of plan.conflicts) {
        if (options?.keepNewest && conflict.newer !== 'equal') {
          if (conflict.newer === 'cedb') {
            setEntityScalar(intoDoc, id, conflict.field, conflict.cedbValue);
            result.changed = true;
          }
          // newer === 'pedb': our side already holds the newer value.
          continue;
        }
        result.conflicts.push({ ...conflict, id });
      }
    }
  }

  return result;
}
