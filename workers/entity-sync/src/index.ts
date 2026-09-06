/**
 * Entity-sync Worker — Phase 1 of docs/entity-sync-planning.md.
 *
 *   GET  /sync/pull?since=<seq>&limit=<n>   → changes with seq > since
 *   POST /sync/push   { entities: [...] }   → applied / reconciled / conflicts
 *
 * Server-authoritative revisions. One owner per deployment: every request
 * carries a GitHub bearer token, the Worker asks GitHub whose it is, and
 * rejects anyone but OWNER_GITHUB_ID. `seq` is a per-owner monotonic counter
 * bumped once per push (compare-and-swap); it's the pull cursor.
 */
import { bearerToken, verifyGitHubUser as defaultVerifyGitHubUser } from './github';
import type { GitHubUser } from './github';
import { handleAchievementsGet, handleAchievementsPut, parseAchievementsPut } from './achievements';
import {
  parsePullQuery,
  parsePushRequest,
  type AppliedEntity,
  type ConflictEntity,
  type PullChange,
  type PullResponse,
  type PushEntity,
  type PushResponse,
  type ReconciledEntity,
} from './protocol';

export interface Env {
  DB: D1Database;
  /** Numeric GitHub user id allowed to sync here. */
  OWNER_GITHUB_ID: string;
  /** Test seam: point GitHub identity lookups at a mock. */
  GITHUB_API_BASE?: string;
  /**
   * Commit or tag this Worker was deployed from. Optional but recommended:
   * set it at deploy time (`wrangler deploy --var SOURCE_COMMIT:$(git rev-parse HEAD)`)
   * so the AGPL source pointer resolves to the exact running code.
   */
  SOURCE_COMMIT?: string;
}

/**
 * AGPL-3.0 section 13: a remote user of this network service must be able to
 * obtain the Corresponding Source of the running version. This Worker is a
 * modified covered work, so every response advertises where its source lives
 * (`x-source-repository`), `GET /source` redirects to it, and `GET /` reports
 * it in the body. Keep `SOURCE_REPOSITORY` pointing at the canonical repo.
 */
const SOURCE_REPOSITORY = 'https://github.com/grognard/grognard';
const LICENSE = 'AGPL-3.0-only';

const sourceUrl = (env: Env): string => {
  const ref = env.SOURCE_COMMIT?.trim();
  return `${SOURCE_REPOSITORY}/tree/${ref && /^[\w.\-/]+$/.test(ref) ? ref : 'main'}/workers/entity-sync`;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Best-effort detection of D1 refusing a write because a plan limit was hit
 * (free tier: 100k rows/day). D1 surfaces this as an exception on the binding;
 * the wording isn't contractual, so match broadly and let the client treat a
 * `429 { quota: true }` as "stop pushing, resume later".
 */
const isWriteQuotaError = (err: unknown): boolean => {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes('exceeded') ||
    message.includes('quota') ||
    message.includes('rows written') ||
    message.includes('daily limit') ||
    message.includes('limit exceeded') ||
    (message.includes('too many') && message.includes('write'))
  );
};

interface StoredEntity {
  central_id: string;
  kind: PullChange['kind'];
  revision: number;
  content_xml: string;
  content_hash: string;
  deleted: number;
  seq: number;
}

type AuthResult = { ok: true; ownerId: string } | { ok: false; response: Response };

type VerifyGitHubUser = (token: string, apiBase?: string) => Promise<GitHubUser | null>;

async function authenticate(
  request: Request,
  env: Env,
  verifyGitHubUser: VerifyGitHubUser,
): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) {
    return { ok: false, response: json({ error: 'Missing bearer token.' }, 401) };
  }
  const user = await verifyGitHubUser(token, env.GITHUB_API_BASE);
  if (!user) {
    return { ok: false, response: json({ error: 'Could not verify GitHub identity.' }, 401) };
  }
  if (String(user.id) !== String(env.OWNER_GITHUB_ID)) {
    return {
      ok: false,
      response: json({ error: 'This account is not the owner of this sync store.' }, 403),
    };
  }
  return { ok: true, ownerId: String(user.id) };
}

/**
 * Reserve `count` consecutive sequence numbers for `ownerId`; returns the base
 * (assigned seqs are base+1 … base+count). Compare-and-swap on `sync_counter`
 * so two concurrent pushes can't hand out the same seq.
 */
async function reserveSeqRange(db: D1Database, ownerId: string, count: number): Promise<number> {
  const readBase = async (): Promise<number> => {
    const row = await db
      .prepare('SELECT last_seq FROM sync_counter WHERE owner_id = ?')
      .bind(ownerId)
      .first<{ last_seq: number }>();
    return row?.last_seq ?? 0;
  };

  if (count === 0) return readBase();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await db
      .prepare('SELECT last_seq FROM sync_counter WHERE owner_id = ?')
      .bind(ownerId)
      .first<{ last_seq: number }>();
    if (row) {
      const res = await db
        .prepare('UPDATE sync_counter SET last_seq = ? WHERE owner_id = ? AND last_seq = ?')
        .bind(row.last_seq + count, ownerId, row.last_seq)
        .run();
      if (res.meta.changes === 1) return row.last_seq;
    } else {
      const res = await db
        .prepare(
          'INSERT INTO sync_counter (owner_id, last_seq) VALUES (?, ?) ON CONFLICT(owner_id) DO NOTHING',
        )
        .bind(ownerId, count)
        .run();
      if ((res.meta.changes ?? 0) === 1) return 0;
    }
  }
  throw new Error('sync_counter contention: could not reserve a sequence range');
}

async function handlePull(
  db: D1Database,
  ownerId: string,
  since: number,
  limit: number,
): Promise<PullResponse> {
  const { results } = await db
    .prepare(
      `SELECT central_id, kind, revision, content_xml, content_hash, deleted, seq
         FROM central_entities
        WHERE owner_id = ? AND seq > ?
        ORDER BY seq
        LIMIT ?`,
    )
    .bind(ownerId, since, limit)
    .all<StoredEntity>();

  const changes: PullChange[] = results.map((row) => ({
    centralId: row.central_id,
    kind: row.kind,
    revision: row.revision,
    contentXml: row.content_xml,
    contentHash: row.content_hash,
    deleted: row.deleted === 1,
    seq: row.seq,
  }));

  return {
    changes,
    highSeq: changes.length > 0 ? changes[changes.length - 1]!.seq : since,
    hasMore: changes.length === limit,
  };
}

async function handlePush(
  db: D1Database,
  ownerId: string,
  entities: PushEntity[],
): Promise<PushResponse> {
  // A push without a centralId is a first sync for that entity: adopt its
  // localId as the central id (both are kind-prefixed UUIDs). So local id ==
  // central id for every entity, server-born or client-born.
  const centralIdFor = (e: PushEntity): string => e.centralId ?? e.localId;
  const referencedIds = [...new Set(entities.map(centralIdFor))];

  const stored = new Map<string, StoredEntity>();
  // D1 has no array binding; chunk an IN (...) list.
  for (let i = 0; i < referencedIds.length; i += 90) {
    const slice = referencedIds.slice(i, i + 90);
    const placeholders = slice.map(() => '?').join(', ');
    const { results } = await db
      .prepare(
        `SELECT central_id, kind, revision, content_xml, content_hash, deleted, seq
           FROM central_entities
          WHERE owner_id = ? AND central_id IN (${placeholders})`,
      )
      .bind(ownerId, ...slice)
      .all<StoredEntity>();
    for (const row of results) stored.set(row.central_id, row);
  }

  interface PendingWrite {
    centralId: string;
    kind: PushEntity['kind'];
    revision: number;
    contentXml: string;
    contentHash: string;
    deleted: boolean;
    localId: string;
  }

  const writes: PendingWrite[] = [];
  const reconciled: ReconciledEntity[] = [];
  const conflicts: ConflictEntity[] = [];

  for (const e of entities) {
    const centralId = centralIdFor(e);
    const existing = stored.get(centralId);

    if (!existing) {
      // First time the server sees this id. A genuine first push has
      // baseRevision 0 → revision 1; a re-seed against a rebuilt central store
      // carries the client's last-known revision → keep climbing from there.
      writes.push({
        centralId,
        kind: e.kind,
        revision: Math.max(e.baseRevision, 0) + 1,
        contentXml: e.contentXml,
        contentHash: e.contentHash,
        deleted: e.deleted ?? false,
        localId: e.localId,
      });
      continue;
    }

    if (existing.revision === e.baseRevision) {
      writes.push({
        centralId,
        kind: e.kind,
        revision: e.baseRevision + 1,
        contentXml: e.contentXml,
        contentHash: e.contentHash,
        deleted: e.deleted ?? false,
        localId: e.localId,
      });
      continue;
    }

    // Base revision is stale. If the content already matches, the two sides
    // converged by another path (e.g. a bulk re-hash): no write, tell the
    // client to adopt the server's revision as its new baseline.
    if (existing.content_hash === e.contentHash && existing.deleted === (e.deleted ? 1 : 0)) {
      reconciled.push({
        localId: e.localId,
        centralId,
        revision: existing.revision,
        seq: existing.seq,
      });
      continue;
    }

    conflicts.push({
      localId: e.localId,
      centralId,
      serverRevision: existing.revision,
      serverHash: existing.content_hash,
      serverXml: existing.content_xml,
      serverDeleted: existing.deleted === 1,
    });
  }

  const base = await reserveSeqRange(db, ownerId, writes.length);
  const now = new Date().toISOString();

  const applied: AppliedEntity[] = writes.map((w, index) => ({
    localId: w.localId,
    centralId: w.centralId,
    revision: w.revision,
    seq: base + index + 1,
  }));

  if (writes.length > 0) {
    const statements = writes.map((w, index) =>
      db
        .prepare(
          `INSERT INTO central_entities
             (central_id, owner_id, kind, revision, content_xml, content_hash, deleted, seq, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT(owner_id, central_id) DO UPDATE SET
             kind = excluded.kind,
             revision = excluded.revision,
             content_xml = excluded.content_xml,
             content_hash = excluded.content_hash,
             deleted = excluded.deleted,
             seq = excluded.seq,
             updated_at = excluded.updated_at`,
        )
        .bind(
          w.centralId,
          ownerId,
          w.kind,
          w.revision,
          w.contentXml,
          w.contentHash,
          w.deleted ? 1 : 0,
          base + index + 1,
          now,
        ),
    );
    await db.batch(statements);
  }

  return {
    applied,
    reconciled,
    conflicts,
    highSeq: writes.length > 0 ? base + writes.length : base,
  };
}

export interface WorkerDeps {
  /** Override the GitHub identity lookup (tests). */
  verifyGitHubUser?: VerifyGitHubUser;
}

export function createWorker(deps: WorkerDeps = {}) {
  const verifyGitHubUser = deps.verifyGitHubUser ?? defaultVerifyGitHubUser;

  const handle = async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json({
        ok: true,
        service: 'grognard-entity-sync',
        license: LICENSE,
        source: sourceUrl(env),
      });
    }

    // AGPL-3.0 s.13 source offer — unauthenticated, so any remote user can reach it.
    if (request.method === 'GET' && url.pathname === '/source') {
      return new Response(null, { status: 302, headers: { location: sourceUrl(env) } });
    }

    const auth = await authenticate(request, env, verifyGitHubUser);
    if (!auth.ok) return auth.response;

    try {
      if (request.method === 'GET' && url.pathname === '/sync/pull') {
        const parsed = parsePullQuery(url.searchParams);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        return json(await handlePull(env.DB, auth.ownerId, parsed.value.since, parsed.value.limit));
      }

      if (request.method === 'POST' && url.pathname === '/sync/push') {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Body must be valid JSON.' }, 400);
        }
        const parsed = parsePushRequest(body);
        if (!parsed.ok) {
          const tooMany = parsed.error.startsWith('Too many');
          return json({ error: parsed.error }, tooMany ? 413 : 400);
        }
        return json(await handlePush(env.DB, auth.ownerId, parsed.value.entities));
      }

      if (request.method === 'GET' && url.pathname === '/sync/achievements') {
        const remote = await handleAchievementsGet(env.DB, auth.ownerId);
        if (!remote) return json({ error: 'No achievements blob stored yet.' }, 404);
        return json(remote);
      }

      if (request.method === 'PUT' && url.pathname === '/sync/achievements') {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Body must be valid JSON.' }, 400);
        }
        const parsed = parseAchievementsPut(body);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        return json(
          await handleAchievementsPut(
            env.DB,
            auth.ownerId,
            parsed.value.baseRevision,
            parsed.value.blob,
          ),
        );
      }
    } catch (err) {
      if (isWriteQuotaError(err)) {
        return json(
          {
            error:
              'The sync server has reached its database write limit for now — sync will resume automatically.',
            quota: true,
          },
          429,
        );
      }
      return json({ error: err instanceof Error ? err.message : 'Internal error.' }, 500);
    }

    return json({ error: 'Not found.' }, 404);
  };

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const res = await handle(request, env);
      // Advertise the source location on every response (AGPL-3.0 s.13).
      const out = new Response(res.body, res);
      out.headers.set('x-source-repository', SOURCE_REPOSITORY);
      out.headers.set('x-license', LICENSE);
      return out;
    },
  };
}

export default createWorker();
