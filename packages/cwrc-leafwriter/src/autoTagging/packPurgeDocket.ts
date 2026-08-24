/**
 * Local **pack purge docket**: developer purge-orders shipped in the authority
 * pack bundle, queued for manual review after install.
 *
 * Mirrors the merge-docket pattern (suggestions + resolutions JSONL) but the
 * payload comes from pack maintainers (`from: "developer"`), not from PEDB merges.
 */

export const PACK_PURGE_ORDERS_FILE = 'pack-purge-orders.jsonl';
export const PACK_PURGE_RESOLUTIONS_FILE = 'pack-purge-order-resolutions.jsonl';

export type PackPurgeOrderKind =
  'concordance-unlink' | 'concordance-link' | 'concordance-replace' | 'pack-note';

export interface PackPurgeOrder {
  id: string;
  kind: PackPurgeOrderKind;
  when: string;
  from: 'developer';
  note: string;
  bundleVersion?: string;
  entityKind?: string;
  source?: string;
  authorityId?: string;
  remove?: Record<string, string>;
  add?: Record<string, string>;
  /** When this order was ingested into the local docket. */
  ingestedAt?: string;
}

export type PackPurgeAction = 'applied' | 'ignored';

export interface PackPurgeResolution {
  id: string;
  orderId: string;
  when: string;
  action: PackPurgeAction;
}

const randomId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
};

export function makePackPurgeResolution(
  orderId: string,
  action: PackPurgeAction,
  when: string = new Date().toISOString(),
): PackPurgeResolution {
  return { id: randomId('purge-res'), orderId, when, action };
}

function parseJsonl<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // skip
    }
  }
  return out;
}

function appendJsonl<T>(existing: string, records: T[]): string {
  if (records.length === 0) return existing;
  const lines = records.map((record) => JSON.stringify(record));
  const base = existing.trimEnd();
  return base ? `${base}\n${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}

/** Parse shipped purge-orders.ndjson text into typed orders. */
export function parseShippedPurgeOrders(text: string): PackPurgeOrder[] {
  return parseJsonl<PackPurgeOrder>(text).filter((row) =>
    Boolean(row?.id && row?.kind && row?.note && row?.from === 'developer'),
  );
}

/**
 * Merge newly shipped orders into the local docket text, skipping ids already
 * present (whether pending or previously resolved is handled at read time).
 */
export function mergeShippedOrdersIntoDocket(
  existingDocketText: string,
  shipped: PackPurgeOrder[],
  ingestedAt: string = new Date().toISOString(),
): { text: string; added: number } {
  const existing = parseJsonl<PackPurgeOrder>(existingDocketText);
  const seen = new Set(existing.map((row) => row.id));
  const toAdd = shipped.filter((row) => !seen.has(row.id)).map((row) => ({ ...row, ingestedAt }));
  return {
    text: appendJsonl(existingDocketText, toAdd),
    added: toAdd.length,
  };
}

export function pendingPackPurgeOrders(
  docketText: string,
  resolutionsText: string,
): PackPurgeOrder[] {
  const orders = parseJsonl<PackPurgeOrder>(docketText);
  const resolved = new Set(
    parseJsonl<PackPurgeResolution>(resolutionsText).map((row) => row.orderId),
  );
  return orders.filter((order) => !resolved.has(order.id));
}

export function appendPackPurgeResolutions(
  existingText: string,
  resolutions: PackPurgeResolution[],
): string {
  return appendJsonl(existingText, resolutions);
}

export function packPurgeDocketPaths(entityDbFolder: string): {
  orders: string;
  resolutions: string;
} {
  // Keep beside authority-databases/, same level as packs.manifest.json.
  const base = entityDbFolder.replace(/[/\\]+$/, '');
  return {
    orders: `${base}/authority-databases/${PACK_PURGE_ORDERS_FILE}`,
    resolutions: `${base}/authority-databases/${PACK_PURGE_RESOLUTIONS_FILE}`,
  };
}
