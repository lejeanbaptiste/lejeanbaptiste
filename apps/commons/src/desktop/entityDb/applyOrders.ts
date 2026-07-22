import { getDatabaseId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  composeRemap,
  pendingOrders,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import type { EntityStore } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import {
  applyKeyRemapToRoots,
  type KeyRemapFileOps,
  type KeyRemapSummary,
} from './applyKeyRemap';
import { collectXmlFiles } from '../xpath/collectXmlFiles';

/**
 * Replay the durable order log against this project checkout: apply every
 * merge/delete recorded in the attached database that this checkout hasn't
 * applied yet, then advance the per-machine cursor. This is what makes a merge
 * done on another machine (or before this clone existed) converge here on open,
 * even when the eager cross-project crawl couldn't see this tree at merge time.
 *
 * Replay is idempotent: rewriting `old → new` on files already rewritten is a
 * no-op, so a lost/blank cursor only costs a redundant scan, never correctness.
 */

export interface ApplyOrdersResult {
  /** How many orders were applied this run (0 when already up to date). */
  ordersApplied: number;
  /** Corpus rewrite summary, or null when nothing was pending. */
  summary: KeyRemapSummary | null;
}

const desktopFileOps = (): KeyRemapFileOps => ({
  listXmlFiles: (projectRoot) => collectXmlFiles(projectRoot),
  readFile: (filePath) => window.electronAPI!.readFile(filePath),
  writeFile: (filePath, content) => window.electronAPI!.writeFile(filePath, content),
});

export async function applyPendingOrders(
  store: EntityStore,
  ops: KeyRemapFileOps = desktopFileOps(),
): Promise<ApplyOrdersResult> {
  const dbId = getDatabaseId(await store.loadEntities());
  if (!dbId) return { ordersApplied: 0, summary: null };

  const [orders, applied] = await Promise.all([
    store.readEntityOrders(),
    store.readAppliedOrderIds(),
  ]);
  const pending = pendingOrders(orders, dbId, applied);
  if (pending.length === 0) return { ordersApplied: 0, summary: null };

  const remap = composeRemap(pending);
  const roots = await store.registryProjectRoots();
  const summary = await applyKeyRemapToRoots(roots, store.entitiesPath, remap, ops);

  for (const order of pending) applied.add(order.id);
  await store.writeAppliedOrderIds(applied);

  return { ordersApplied: pending.length, summary };
}
