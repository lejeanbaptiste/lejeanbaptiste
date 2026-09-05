/**
 * The entity-sync wire contract, as executable scenarios — implementation-
 * independent. `workers/entity-sync/test/sync.test.ts` runs these against the
 * Worker in-process; a future server (Node + Postgres, etc.) runs the same set
 * against an HTTP client. The normative prose is docs/entity-sync-protocol.md.
 *
 * A `ConformanceClient` speaks raw request/response so status codes are
 * observable, plus `reset()` to clear owner state, plus three tokens the
 * server recognises as: its owner, some other valid account, and garbage.
 */
import assert from 'node:assert/strict';

export interface RawResponse {
  status: number;
  body: unknown;
}

export interface ConformanceClient {
  request(
    method: 'GET' | 'POST',
    path: string,
    opts?: { body?: unknown; token?: string | null },
  ): Promise<RawResponse>;
  reset(): Promise<void>;
  tokens: { owner: string; nonOwner: string; invalid: string };
}

interface PushEntityInput {
  localId?: string;
  centralId?: string;
  kind?: string;
  baseRevision?: number;
  contentXml?: string;
  contentHash?: string;
  deleted?: boolean;
}

const withDefaults = (e: PushEntityInput, i: number): Record<string, unknown> => ({
  localId: `person-local-${i}`,
  kind: 'person',
  baseRevision: 0,
  contentXml: `<person xml:id="p${i}"/>`,
  contentHash: `hash-${i}`,
  ...e,
});

type Body = Record<string, unknown> & {
  applied?: { localId: string; centralId: string; revision: number; seq: number }[];
  reconciled?: { localId: string; centralId: string; revision: number; seq: number }[];
  conflicts?: {
    localId: string;
    centralId: string;
    serverRevision: number;
    serverHash: string;
    serverXml: string;
    serverDeleted: boolean;
  }[];
  changes?: {
    centralId: string;
    kind: string;
    revision: number;
    contentXml: string;
    contentHash: string;
    deleted: boolean;
    seq: number;
  }[];
  highSeq?: number;
  hasMore?: boolean;
  error?: string;
};

const push = async (
  c: ConformanceClient,
  entities: PushEntityInput[],
  token: string | null = c.tokens.owner,
): Promise<{ status: number; body: Body }> => {
  const res = await c.request('POST', '/sync/push', {
    body: { entities: entities.map(withDefaults) },
    token,
  });
  return { status: res.status, body: res.body as Body };
};

const pull = async (
  c: ConformanceClient,
  since = 0,
  limit?: number,
  token: string | null = c.tokens.owner,
): Promise<{ status: number; body: Body }> => {
  const query = `?since=${since}${limit === undefined ? '' : `&limit=${limit}`}`;
  const res = await c.request('GET', `/sync/pull${query}`, { token });
  return { status: res.status, body: res.body as Body };
};

/** Assert every key in `expected` matches `actual` (deep, partial). */
const matches = (actual: unknown, expected: Record<string, unknown>, label = 'value'): void => {
  assert.ok(actual && typeof actual === 'object', `${label} should be an object`);
  for (const [key, want] of Object.entries(expected)) {
    const got: unknown = (actual as Record<string, unknown>)[key];
    if (want && typeof want === 'object')
      matches(got, want as Record<string, unknown>, `${label}.${key}`);
    else assert.deepEqual(got, want, `${label}.${key}`);
  }
};

export interface ConformanceScenario {
  name: string;
  run: (client: ConformanceClient) => Promise<void>;
}

export const conformanceScenarios: ConformanceScenario[] = [
  {
    name: 'first push adopts localId as the central id, and pulls back',
    run: async (c) => {
      const res = await push(c, [{ localId: 'person-abc-123' }]);
      assert.equal(res.status, 200);
      assert.equal(res.body.applied?.length, 1);
      assert.equal(res.body.conflicts?.length, 0);
      matches(res.body.applied![0], { centralId: 'person-abc-123', revision: 1, seq: 1 });
      assert.equal(res.body.highSeq, 1);

      const pulled = await pull(c, 0);
      assert.equal(pulled.body.changes?.length, 1);
      matches(pulled.body.changes![0], {
        centralId: 'person-abc-123',
        revision: 1,
        deleted: false,
        seq: 1,
      });
      assert.equal(pulled.body.highSeq, 1);
      assert.equal(pulled.body.hasMore, false);
    },
  },
  {
    name: 'accepts a `thing` entity (custom sub-type tagging) end to end',
    run: async (c) => {
      const res = await push(c, [
        {
          localId: 'thing-qi-1',
          kind: 'thing',
          contentXml: '<rs xml:id="thing-qi-1" type="philosophical_concept">氣</rs>',
        },
      ]);
      assert.equal(res.status, 200);
      matches(res.body.applied![0], { centralId: 'thing-qi-1', revision: 1, seq: 1 });

      const pulled = await pull(c, 0);
      assert.equal(pulled.body.changes?.length, 1);
      matches(pulled.body.changes![0], { centralId: 'thing-qi-1', kind: 'thing', revision: 1 });
    },
  },
  {
    name: 're-seeds an unknown centralId, keeping revisions climbing',
    run: async (c) => {
      const res = await push(c, [
        {
          localId: 'person-local-x',
          centralId: 'person-central-x',
          baseRevision: 4,
          contentHash: 'reseed',
        },
      ]);
      assert.equal(res.body.conflicts?.length, 0);
      matches(res.body.applied![0], { centralId: 'person-central-x', revision: 5, seq: 1 });
      const pulled = await pull(c, 0);
      matches(pulled.body.changes![0], { centralId: 'person-central-x', revision: 5 });
    },
  },
  {
    name: 'fast-forwards when baseRevision matches the stored revision',
    run: async (c) => {
      const { body } = await push(c, [{ localId: 'person-a' }]);
      const centralId = body.applied![0]!.centralId;
      const ff = await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 1,
          contentXml: '<person xml:id="v2"/>',
          contentHash: 'hash-v2',
        },
      ]);
      assert.equal(ff.body.conflicts?.length, 0);
      matches(ff.body.applied![0], { centralId, revision: 2, seq: 2 });
      const pulled = await pull(c, 1);
      matches(pulled.body.changes![0], { revision: 2, contentHash: 'hash-v2' });
    },
  },
  {
    name: 'returns a conflict (and writes nothing) when baseRevision is stale',
    run: async (c) => {
      const { body } = await push(c, [{ localId: 'person-a' }]);
      const centralId = body.applied![0]!.centralId;
      await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 1,
          contentHash: 'hash-v2',
          contentXml: '<person xml:id="v2"/>',
        },
      ]);
      const stale = await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 0,
          contentHash: 'divergent',
          contentXml: '<person xml:id="d"/>',
        },
      ]);
      assert.equal(stale.body.applied?.length, 0);
      assert.equal(stale.body.reconciled?.length, 0);
      assert.equal(stale.body.conflicts?.length, 1);
      matches(stale.body.conflicts![0], { centralId, serverRevision: 2, serverHash: 'hash-v2' });
      assert.equal(stale.body.conflicts![0]!.serverXml, '<person xml:id="v2"/>');
      assert.equal((await pull(c, 2)).body.changes?.length, 0);
    },
  },
  {
    name: 'reconciles (no write) when the base is stale but content already matches',
    run: async (c) => {
      const { body } = await push(c, [{ localId: 'person-a' }]);
      const centralId = body.applied![0]!.centralId;
      await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 1,
          contentHash: 'converged',
          contentXml: '<person xml:id="c"/>',
        },
      ]);
      const recon = await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 0,
          contentHash: 'converged',
          contentXml: '<person xml:id="c"/>',
        },
      ]);
      assert.equal(recon.body.conflicts?.length, 0);
      assert.equal(recon.body.applied?.length, 0);
      matches(recon.body.reconciled![0], { centralId, revision: 2, seq: 2 });
      assert.equal(recon.body.highSeq, 2);
    },
  },
  {
    name: 'propagates a delete with an empty contentXml/contentHash',
    run: async (c) => {
      const { body } = await push(c, [{ localId: 'person-a' }]);
      const centralId = body.applied![0]!.centralId;
      const del = await push(c, [
        {
          localId: 'person-a',
          centralId,
          baseRevision: 1,
          deleted: true,
          contentXml: '',
          contentHash: '',
        },
      ]);
      assert.equal(del.status, 200);
      matches(del.body.applied![0], { centralId, revision: 2 });
      const pulled = await pull(c, 1);
      matches(pulled.body.changes![0], { centralId, deleted: true });
    },
  },
  {
    name: 'paginates by seq',
    run: async (c) => {
      await push(c, [{ localId: 'a' }, { localId: 'b' }, { localId: 'c' }]);
      const page1 = await pull(c, 0, 2);
      assert.equal(page1.body.changes?.length, 2);
      assert.deepEqual(
        page1.body.changes!.map((x) => x.seq),
        [1, 2],
      );
      assert.equal(page1.body.hasMore, true);
      assert.equal(page1.body.highSeq, 2);
      const page2 = await pull(c, page1.body.highSeq!, 2);
      assert.deepEqual(
        page2.body.changes!.map((x) => x.seq),
        [3],
      );
      assert.equal(page2.body.hasMore, false);
    },
  },
  {
    name: 'rejects a request with no bearer token (401)',
    run: async (c) => {
      assert.equal((await c.request('GET', '/sync/pull?since=0', { token: null })).status, 401);
    },
  },
  {
    name: 'rejects an unverifiable token (401)',
    run: async (c) => {
      assert.equal((await pull(c, 0, undefined, c.tokens.invalid)).status, 401);
    },
  },
  {
    name: 'rejects a valid token that is not the owner (403)',
    run: async (c) => {
      assert.equal((await pull(c, 0, undefined, c.tokens.nonOwner)).status, 403);
    },
  },
  {
    name: 'rejects an over-limit push with 413',
    run: async (c) => {
      const entities = Array.from({ length: 201 }, (_, i) => ({ localId: `p${i}` }));
      assert.equal((await push(c, entities)).status, 413);
    },
  },
  {
    name: 'serves an unauthenticated health check',
    run: async (c) => {
      const res = await c.request('GET', '/', { token: null });
      assert.equal(res.status, 200);
      matches(res.body, { ok: true, service: 'grognard-entity-sync' });
    },
  },
];
