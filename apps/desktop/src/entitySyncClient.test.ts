import { EntitySyncAuthError, EntitySyncClient, EntitySyncError } from './entitySyncClient';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const makeClient = (fetchImpl: typeof fetch, token: string | null = 'gh-token') =>
  new EntitySyncClient({
    endpoint: 'https://sync.example.workers.dev/',
    getToken: () => token,
    fetchImpl,
    retryBaseMs: 0,
    maxRetries: 3,
  });

describe('EntitySyncClient', () => {
  it('pull hits /sync/pull with since/limit and a bearer token', async () => {
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://sync.example.workers.dev/sync/pull?since=7&limit=250');
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer gh-token');
      return jsonResponse({ changes: [], highSeq: 7, hasMore: false });
    }) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).pull(7, 250);
    expect(result).toEqual({ changes: [], highSeq: 7, hasMore: false });
  });

  it('push posts the entities as JSON', async () => {
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://sync.example.workers.dev/sync/push');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ entities: [{ localId: 'p1' }] });
      return jsonResponse({ applied: [], reconciled: [], conflicts: [], highSeq: 3 });
    }) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).push([{ localId: 'p1' } as never]);
    expect(result.highSeq).toBe(3);
  });

  it('throws EntitySyncAuthError on 401/403 without retrying', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: 'not the owner' }, 403),
    ) as unknown as typeof fetch;
    const client = makeClient(fetchImpl);
    await expect(client.pull(0)).rejects.toBeInstanceOf(EntitySyncAuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws EntitySyncAuthError when there is no token', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    await expect(makeClient(fetchImpl, null).pull(0)).rejects.toBeInstanceOf(EntitySyncAuthError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries 5xx then succeeds', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls += 1;
      if (calls < 3) return jsonResponse({ error: 'boom' }, 503);
      return jsonResponse({ changes: [], highSeq: 0, hasMore: false });
    }) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).pull(0);
    expect(calls).toBe(3);
    expect(result.highSeq).toBe(0);
  });

  it('retries network errors then gives up as EntitySyncError', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await expect(client.pull(0)).rejects.toBeInstanceOf(EntitySyncError);
    expect(fetchImpl).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('aborts a request that produces no response within requestTimeoutMs, then retries', async () => {
    const fetchImpl = jest.fn(
      (_url: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          (init?.signal as AbortSignal | undefined)?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const client = new EntitySyncClient({
      endpoint: 'https://sync.example',
      getToken: () => 'gh-token',
      fetchImpl,
      retryBaseMs: 0,
      maxRetries: 1,
      requestTimeoutMs: 10,
    });
    await expect(client.pull(0)).rejects.toBeInstanceOf(EntitySyncError);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // initial + 1 retry, both timed out
  });

  it('does not retry a 400', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: 'bad request' }, 400),
    ) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).pull(0)).rejects.toMatchObject({ status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects an over-limit push before calling fetch', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const oversized = Array.from({ length: EntitySyncClient.pushChunkLimit + 1 }, (_, i) => ({
      localId: `p${i}`,
    })) as never[];
    await expect(makeClient(fetchImpl).push(oversized)).rejects.toBeInstanceOf(EntitySyncError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('getAchievements returns null on 404', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: 'missing' }, 404),
    ) as unknown as typeof fetch;
    await expect(makeClient(fetchImpl).getAchievements()).resolves.toBeNull();
  });

  it('putAchievements PUTs the blob', async () => {
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://sync.example.workers.dev/sync/achievements');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(String(init?.body))).toEqual({ baseRevision: 2, blob: 'cipher' });
      return jsonResponse({ applied: true, revision: 3, sha256: 'abc' });
    }) as unknown as typeof fetch;
    const result = await makeClient(fetchImpl).putAchievements({ baseRevision: 2, blob: 'cipher' });
    expect(result).toEqual({ applied: true, revision: 3, sha256: 'abc' });
  });
});
