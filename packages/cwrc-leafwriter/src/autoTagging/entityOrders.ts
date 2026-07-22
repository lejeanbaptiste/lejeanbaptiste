/**
 * The **order log**: the durable, timestamped record of entity merges and
 * deletions, so that a project that wasn't reachable when the change was made
 * (offline, on another machine, a fresh clone, a folder that moved) still
 * converges the next time it opens against the same database.
 *
 * Today's design walks a *path registry* and rewrites corpus keys immediately;
 * if a project tree isn't visible from the current machine it is silently
 * missed (see `entity-registry-merges-and-splits.md`, Stories A–F). The order
 * log inverts that: every merge/delete appends one line here (beside the shared
 * `entities.xml`), and each consumer replays the lines it hasn't applied yet.
 * The immediate cross-project crawl stays as an eager optimization; the log is
 * the correctness backbone that makes the eager crawl's misses self-heal.
 *
 * An order is simply a timestamped, database-scoped **remap** — the same
 * `{ oldKey → newKey | null }` shape the merge/delete UI already produces
 * (`null` = key deleted). Because corpus `@key`s live in the attached database's
 * id space, applying an order is a direct `rewriteMentionKeys`; no translation
 * is needed while a project speaks one database's ids. (Cross-database
 * translation via the `ljb-central` concordance is layered on in a later phase.)
 *
 * Storage reuses the JSONL primitives of `decisionLog.ts`.
 */

import type { EntityFileApi } from './entityStore';
import { joinPath } from './pathJoin';

export const ORDERS_FILE = 'entity-orders.jsonl';
export const ORDER_CURSOR_FILE = 'entity-order-cursor.json';

export interface EntityOrder {
  /** Unique id for this order (dedup key for idempotent replay). */
  id: string;
  /** ISO timestamp the order was recorded. */
  when: string;
  /** Fingerprint of the database the mutation happened in (`getDatabaseId`). */
  dbId: string;
  /** Corpus `@key` rewrite: old id → surviving id, or `null` to strip the key. */
  remap: Record<string, string | null>;
}

/** The order log path: a sibling of `entities.xml` (like the project registry). */
export function ordersPathFor(entitiesPath: string): string {
  return entitiesPath.replace(/[^/\\]+$/, ORDERS_FILE);
}

const randomOrderId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `order-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
};

/** Build an order from a remap (as produced by merge/delete). */
export function makeOrder(
  dbId: string,
  remap: Record<string, string | null>,
  when: string = new Date().toISOString(),
): EntityOrder {
  return { id: randomOrderId(), when, dbId, remap };
}

/** Serialize one order to a JSONL line (no trailing newline). */
export function formatOrder(order: EntityOrder): string {
  return JSON.stringify(order);
}

/** Parse a JSONL log body into orders, skipping blank/corrupt lines. */
export function parseOrders(jsonl: string): EntityOrder[] {
  const orders: EntityOrder[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as EntityOrder;
      if (parsed && parsed.id && parsed.dbId && parsed.remap) orders.push(parsed);
    } catch {
      // skip corrupt lines rather than failing the whole log
    }
  }
  return orders;
}

/** Append orders to an existing JSONL body, returning the new body. */
export function appendOrders(existing: string, orders: EntityOrder[]): string {
  if (orders.length === 0) return existing;
  const lines = orders.map(formatOrder);
  const base = existing.trimEnd();
  return base ? `${base}\n${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}

/**
 * Fold a chronological list of order remaps into one composite remap, following
 * chains: if `a→b` then later `b→c`, the result maps both `a→c` and `b→c`; a
 * later delete (`b→null`) likewise repoints everything that pointed at `b`.
 * Orders are sorted by `when` then `id` before folding so replay is
 * deterministic regardless of the order lines arrive across syncs.
 */
export function composeRemap(orders: EntityOrder[]): Record<string, string | null> {
  const sorted = [...orders].sort((a, b) => a.when.localeCompare(b.when) || a.id.localeCompare(b.id));
  const result: Record<string, string | null> = {};
  for (const order of sorted) {
    for (const [from, to] of Object.entries(order.remap)) {
      result[from] = to;
      // repoint anything that already resolved to `from`
      for (const key of Object.keys(result)) {
        if (result[key] === from) result[key] = to;
      }
    }
  }
  return result;
}

/** Read the raw order log (empty when absent/malformed). */
export async function readOrders(api: EntityFileApi, entitiesPath: string): Promise<EntityOrder[]> {
  const path = ordersPathFor(entitiesPath);
  if (!(await api.pathExists(path))) return [];
  try {
    return parseOrders(await api.readFile(path));
  } catch {
    return [];
  }
}

/** Append one order to the log beside `entities.xml`, creating it if needed. */
export async function recordOrder(
  api: EntityFileApi,
  entitiesPath: string,
  order: EntityOrder,
): Promise<void> {
  const path = ordersPathFor(entitiesPath);
  const existing = (await api.pathExists(path)) ? await api.readFile(path) : '';
  await api.armOwnWrite?.(path);
  await api.writeFile(path, appendOrders(existing, [order]));
  await api.notifyOwnWrite?.(path);
}

interface OrderCursor {
  /** Order ids already applied to this project checkout. */
  applied: string[];
}

const parseCursor = (raw: string): OrderCursor => {
  try {
    const parsed = JSON.parse(raw) as Partial<OrderCursor>;
    return { applied: Array.isArray(parsed.applied) ? parsed.applied.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { applied: [] };
  }
};

/**
 * The set of order ids this project checkout has already applied. Stored in the
 * project's `.ljb/` (per-machine, may be gitignored): correctness never depends
 * on it because replay is idempotent (rewriting `a→b` on files already rewritten
 * is a no-op) — the cursor only spares redundant scans.
 */
export async function readAppliedOrderIds(
  api: EntityFileApi,
  projectLjbDir: string,
): Promise<Set<string>> {
  const path = joinPath(projectLjbDir, ORDER_CURSOR_FILE);
  if (!(await api.pathExists(path))) return new Set();
  try {
    return new Set(parseCursor(await api.readFile(path)).applied);
  } catch {
    return new Set();
  }
}

/** Persist the applied-order-id set for this project checkout. */
export async function writeAppliedOrderIds(
  api: EntityFileApi,
  projectLjbDir: string,
  applied: Set<string>,
): Promise<void> {
  const path = joinPath(projectLjbDir, ORDER_CURSOR_FILE);
  await api.ensureDirectory(projectLjbDir);
  const body: OrderCursor = { applied: [...applied] };
  await api.armOwnWrite?.(path);
  await api.writeFile(path, JSON.stringify(body, null, 2));
  await api.notifyOwnWrite?.(path);
}

/**
 * Select the orders this checkout should still apply: those recorded in the
 * attached database (`dbId` match) and not yet in the applied set.
 */
export function pendingOrders(
  orders: EntityOrder[],
  dbId: string,
  applied: Set<string>,
): EntityOrder[] {
  return orders.filter((order) => order.dbId === dbId && !applied.has(order.id));
}
