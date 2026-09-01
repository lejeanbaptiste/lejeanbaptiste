import { describe, expect, it } from 'vitest';
import { MAX_PUSH_ENTITIES, parsePullQuery, parsePushRequest } from '../src/protocol';

const entity = (over: Record<string, unknown> = {}) => ({
  localId: 'person-local-1',
  kind: 'person',
  baseRevision: 0,
  contentXml: '<person xml:id="p1"/>',
  contentHash: 'abc123',
  ...over,
});

describe('parsePushRequest', () => {
  it('accepts a well-formed batch', () => {
    const result = parsePushRequest({ entities: [entity(), entity({ localId: 'p2' })] });
    expect(result.ok).toBe(true);
  });

  it('defaults deleted to false and allows empty XML only when deleted', () => {
    const ok = parsePushRequest({ entities: [entity({ contentXml: '', deleted: true })] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.entities[0]!.deleted).toBe(true);

    const bad = parsePushRequest({ entities: [entity({ contentXml: '' })] });
    expect(bad.ok).toBe(false);
  });

  it('rejects a missing localId, bad kind, and negative baseRevision', () => {
    expect(parsePushRequest({ entities: [entity({ localId: '' })] }).ok).toBe(false);
    expect(parsePushRequest({ entities: [entity({ kind: 'planet' })] }).ok).toBe(false);
    expect(parsePushRequest({ entities: [entity({ baseRevision: -1 })] }).ok).toBe(false);
    expect(parsePushRequest({ entities: [entity({ baseRevision: 1.5 })] }).ok).toBe(false);
  });

  it('rejects an empty or oversized batch', () => {
    expect(parsePushRequest({ entities: [] }).ok).toBe(false);
    const tooMany = parsePushRequest({
      entities: Array.from({ length: MAX_PUSH_ENTITIES + 1 }, (_, i) => entity({ localId: `p${i}` })),
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.error).toMatch(/Too many/);
  });

  it('rejects a non-object body', () => {
    expect(parsePushRequest(null).ok).toBe(false);
    expect(parsePushRequest({ entities: 'nope' }).ok).toBe(false);
  });
});

describe('parsePullQuery', () => {
  it('defaults since to 0 and limit to 500', () => {
    const result = parsePullQuery(new URLSearchParams());
    expect(result).toEqual({ ok: true, value: { since: 0, limit: 500 } });
  });

  it('clamps limit to the maximum', () => {
    const result = parsePullQuery(new URLSearchParams({ limit: '99999' }));
    expect(result.ok && result.value.limit).toBe(1000);
  });

  it('rejects a negative since or non-positive limit', () => {
    expect(parsePullQuery(new URLSearchParams({ since: '-1' })).ok).toBe(false);
    expect(parsePullQuery(new URLSearchParams({ limit: '0' })).ok).toBe(false);
    expect(parsePullQuery(new URLSearchParams({ since: 'abc' })).ok).toBe(false);
  });
});
