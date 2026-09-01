/**
 * Wire types and request validation for the entity-sync protocol. Pure — no
 * D1, no fetch — so it can be unit-tested on its own.
 *
 * The unit of sync is a whole entity. The client sends its TEI export
 * (`contentXml`, from exportEntityElementXml) and the matching
 * `contentHash` (computeEntityContentHash); the server stores both verbatim
 * and never reparses. `baseRevision` is the central revision the client last
 * had for this entity — the server accepts a push only when it still matches.
 *
 * `centralId` is omitted on an entity's first push; the server then adopts the
 * `localId` as the central id (both are kind-prefixed UUIDs), so local id ==
 * central id everywhere and `central_mappings` is only needed for later
 * renames/merges.
 */

export const ENTITY_KINDS = ['person', 'place', 'work', 'office', 'org'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** Server rejects a push carrying more than this many entities (client chunks). */
export const MAX_PUSH_ENTITIES = 200;
export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PULL_LIMIT = 1000;

export interface PushEntity {
  /** Client-local id, echoed back so the client can update its mapping. */
  localId: string;
  /** Central id when the client already has a mapping; absent for a first push. */
  centralId?: string;
  kind: EntityKind;
  /** Central revision the client last saw (0 for a never-synced entity). */
  baseRevision: number;
  contentXml: string;
  contentHash: string;
  deleted?: boolean;
}

export interface PushRequest {
  entities: PushEntity[];
}

export interface AppliedEntity {
  localId: string;
  centralId: string;
  revision: number;
  seq: number;
}

/** Client and server already hold identical content — no write, adopt baseline. */
export interface ReconciledEntity {
  localId: string;
  centralId: string;
  revision: number;
  seq: number;
}

export interface ConflictEntity {
  localId: string;
  centralId: string;
  serverRevision: number;
  serverHash: string;
  serverXml: string;
  serverDeleted: boolean;
}

export interface PushResponse {
  applied: AppliedEntity[];
  reconciled: ReconciledEntity[];
  conflicts: ConflictEntity[];
  highSeq: number;
}

export interface PullChange {
  centralId: string;
  kind: EntityKind;
  revision: number;
  contentXml: string;
  contentHash: string;
  deleted: boolean;
  seq: number;
}

export interface PullResponse {
  changes: PullChange[];
  highSeq: number;
  hasMore: boolean;
}

const isEntityKind = (value: unknown): value is EntityKind =>
  typeof value === 'string' && (ENTITY_KINDS as readonly string[]).includes(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isNonNegInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parsePushRequest(raw: unknown): ParseResult<PushRequest> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const entities = (raw as Record<string, unknown>).entities;
  if (!Array.isArray(entities)) return { ok: false, error: '`entities` must be an array.' };
  if (entities.length === 0) return { ok: false, error: '`entities` must not be empty.' };
  if (entities.length > MAX_PUSH_ENTITIES) {
    return { ok: false, error: `Too many entities in one push (max ${MAX_PUSH_ENTITIES}).` };
  }

  const parsed: PushEntity[] = [];
  for (let i = 0; i < entities.length; i += 1) {
    const e = entities[i] as Record<string, unknown>;
    const at = `entities[${i}]`;
    if (!e || typeof e !== 'object') return { ok: false, error: `${at} must be an object.` };
    if (!isNonEmptyString(e.localId)) return { ok: false, error: `${at}.localId is required.` };
    if (e.centralId !== undefined && !isNonEmptyString(e.centralId)) {
      return { ok: false, error: `${at}.centralId must be a non-empty string when present.` };
    }
    if (!isEntityKind(e.kind)) return { ok: false, error: `${at}.kind is invalid.` };
    if (!isNonNegInt(e.baseRevision)) {
      return { ok: false, error: `${at}.baseRevision must be a non-negative integer.` };
    }
    if (typeof e.contentXml !== 'string') {
      return { ok: false, error: `${at}.contentXml must be a string.` };
    }
    if (typeof e.contentHash !== 'string') {
      return { ok: false, error: `${at}.contentHash must be a string.` };
    }
    const deleted = e.deleted === true;
    if (!deleted && e.contentXml.length === 0) {
      return { ok: false, error: `${at}.contentXml must not be empty unless deleted.` };
    }
    if (!deleted && e.contentHash.length === 0) {
      return { ok: false, error: `${at}.contentHash must not be empty unless deleted.` };
    }
    parsed.push({
      localId: e.localId,
      centralId: e.centralId as string | undefined,
      kind: e.kind,
      baseRevision: e.baseRevision,
      contentXml: e.contentXml,
      contentHash: e.contentHash,
      deleted,
    });
  }
  return { ok: true, value: { entities: parsed } };
}

export function parsePullQuery(
  params: URLSearchParams,
): ParseResult<{ since: number; limit: number }> {
  const sinceRaw = params.get('since') ?? '0';
  const since = Number(sinceRaw);
  if (!Number.isInteger(since) || since < 0) {
    return { ok: false, error: '`since` must be a non-negative integer.' };
  }
  const limitRaw = params.get('limit');
  let limit = DEFAULT_PULL_LIMIT;
  if (limitRaw !== null) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: '`limit` must be a positive integer.' };
    }
    limit = Math.min(parsed, MAX_PULL_LIMIT);
  }
  return { ok: true, value: { since, limit } };
}
