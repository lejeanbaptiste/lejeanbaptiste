import { describe, expect, it } from 'vitest';
import {
  makePackPurgeResolution,
  mergeShippedOrdersIntoDocket,
  parseShippedPurgeOrders,
  pendingPackPurgeOrders,
} from './packPurgeDocket';

describe('packPurgeDocket', () => {
  const shipped = `{"id":"p1","kind":"concordance-unlink","when":"2026-08-04T00:00:00.000Z","from":"developer","note":"Removed bad link","remove":{"cbdb":"1"}}
{"id":"p2","kind":"pack-note","when":"2026-08-04T00:00:00.000Z","from":"developer","note":"Hello"}
`;

  it('parses shipped developer orders only', () => {
    const rows = parseShippedPurgeOrders(shipped);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.from).toBe('developer');
  });

  it('merges without duplicating ids', () => {
    const first = mergeShippedOrdersIntoDocket('', parseShippedPurgeOrders(shipped));
    expect(first.added).toBe(2);
    const second = mergeShippedOrdersIntoDocket(first.text, parseShippedPurgeOrders(shipped));
    expect(second.added).toBe(0);
  });

  it('hides resolved orders from pending', () => {
    const { text } = mergeShippedOrdersIntoDocket('', parseShippedPurgeOrders(shipped));
    const resolution = makePackPurgeResolution('p1', 'ignored');
    const pending = pendingPackPurgeOrders(text, `${JSON.stringify(resolution)}\n`);
    expect(pending.map((row) => row.id)).toEqual(['p2']);
  });
});
