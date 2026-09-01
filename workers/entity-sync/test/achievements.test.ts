import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import type { GitHubUser } from '../src/github';

const OWNER_ID = 424242;
const TOKENS = { owner: 'owner-token', nonOwner: 'other-token' };

const verifyGitHubUser = vi.fn<(token: string) => Promise<GitHubUser | null>>(async (token) => {
  if (token === TOKENS.owner) return { id: OWNER_ID, login: 'daniel' };
  if (token === TOKENS.nonOwner) return { id: 999999, login: 'someone-else' };
  return null;
});
const worker = createWorker({ verifyGitHubUser });

const request = async (
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
) => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await worker.fetch(
    new Request(`https://sync.test${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  await env.DB.exec('DELETE FROM achievements_blob;');
});

describe('achievements blob sync', () => {
  it('GET returns 404 when empty', async () => {
    const res = await request('GET', '/sync/achievements', { token: TOKENS.owner });
    expect(res.status).toBe(404);
  });

  it('PUT creates revision 1, GET round-trips', async () => {
    const put = await request('PUT', '/sync/achievements', {
      token: TOKENS.owner,
      body: { baseRevision: 0, blob: '{"v":2,"data":"abc"}' },
    });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ applied: true, revision: 1 });

    const get = await request('GET', '/sync/achievements', { token: TOKENS.owner });
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({
      revision: 1,
      blob: '{"v":2,"data":"abc"}',
    });
    expect(typeof get.body.sha256).toBe('string');
  });

  it('PUT fast-forwards when baseRevision matches', async () => {
    await request('PUT', '/sync/achievements', {
      token: TOKENS.owner,
      body: { baseRevision: 0, blob: 'first' },
    });
    const second = await request('PUT', '/sync/achievements', {
      token: TOKENS.owner,
      body: { baseRevision: 1, blob: 'second' },
    });
    expect(second.body).toMatchObject({ applied: true, revision: 2, sha256: expect.any(String) });
  });

  it('PUT returns conflict on stale baseRevision', async () => {
    await request('PUT', '/sync/achievements', {
      token: TOKENS.owner,
      body: { baseRevision: 0, blob: 'server-copy' },
    });
    const conflict = await request('PUT', '/sync/achievements', {
      token: TOKENS.owner,
      body: { baseRevision: 0, blob: 'stale-client' },
    });
    expect(conflict.body).toMatchObject({
      conflict: true,
      serverRevision: 1,
      serverBlob: 'server-copy',
    });
  });

  it('rejects non-owner', async () => {
    const res = await request('PUT', '/sync/achievements', {
      token: TOKENS.nonOwner,
      body: { baseRevision: 0, blob: 'nope' },
    });
    expect(res.status).toBe(403);
  });
});
