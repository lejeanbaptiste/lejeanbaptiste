import { env } from 'cloudflare:test';
import { beforeEach, describe, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import type { GitHubUser } from '../src/github';
import { conformanceScenarios, type ConformanceClient } from './conformance';

const OWNER_ID = 424242;
const TOKENS = { owner: 'owner-token', nonOwner: 'other-token', invalid: 'bad-token' };

// Route the injected GitHub lookup by token value so the auth scenarios can
// exercise owner / other-account / invalid without touching the network.
const verifyGitHubUser = vi.fn<(token: string) => Promise<GitHubUser | null>>(async (token) => {
  if (token === TOKENS.owner) return { id: OWNER_ID, login: 'daniel' };
  if (token === TOKENS.nonOwner) return { id: 999999, login: 'someone-else' };
  return null;
});
const worker = createWorker({ verifyGitHubUser });

const client: ConformanceClient = {
  tokens: TOKENS,
  async request(method, path, opts = {}) {
    const headers: Record<string, string> = {};
    const token = 'token' in opts ? opts.token : TOKENS.owner;
    if (token) headers.authorization = `Bearer ${token}`;
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
  },
  async reset() {
    await env.DB.exec('DELETE FROM central_entities;\nDELETE FROM sync_counter;');
  },
};

beforeEach(() => client.reset());

describe('entity-sync wire contract (docs/entity-sync-protocol.md)', () => {
  for (const scenario of conformanceScenarios) {
    it(scenario.name, () => scenario.run(client));
  }
});
