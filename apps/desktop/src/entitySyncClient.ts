/**
 * HTTP client for the entity-sync Worker (workers/entity-sync). Phase 2 of
 * docs/entity-sync-planning.md.
 *
 * Two calls: `pull(since)` and `push(entities)`. Every request carries a
 * GitHub bearer token from `getToken`; the Worker verifies it and rejects any
 * account but its configured owner. Transient failures (network, 5xx, 429)
 * are retried with backoff; a 401/403 throws `EntitySyncAuthError` and is not
 * retried.
 */

export type SyncEntityKind = 'person' | 'place' | 'work' | 'office' | 'org';

export interface SyncPushEntity {
  localId: string;
  /** Omit on an entity's first push — the Worker adopts `localId` as the central id. */
  centralId?: string;
  kind: SyncEntityKind;
  baseRevision: number;
  contentXml: string;
  contentHash: string;
  deleted?: boolean;
}

export interface SyncAppliedEntity {
  localId: string;
  centralId: string;
  revision: number;
  seq: number;
}

export interface SyncConflictEntity {
  localId: string;
  centralId: string;
  serverRevision: number;
  serverHash: string;
  serverXml: string;
  serverDeleted: boolean;
}

export interface SyncPushResult {
  applied: SyncAppliedEntity[];
  reconciled: SyncAppliedEntity[];
  conflicts: SyncConflictEntity[];
  highSeq: number;
}

export interface SyncPullChange {
  centralId: string;
  kind: SyncEntityKind;
  revision: number;
  contentXml: string;
  contentHash: string;
  deleted: boolean;
  seq: number;
}

export interface SyncPullResult {
  changes: SyncPullChange[];
  highSeq: number;
  hasMore: boolean;
}

export class EntitySyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EntitySyncError';
  }
}

export class EntitySyncAuthError extends EntitySyncError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'EntitySyncAuthError';
  }
}

export interface EntitySyncClientOptions {
  /** Base URL of the deployed Worker, e.g. https://ljb-entity-sync.<sub>.workers.dev */
  endpoint: string;
  /** Returns the current GitHub token, or null when the user isn't signed in. */
  getToken: () => Promise<string | null> | string | null;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Base backoff in ms; retry N waits `retryBaseMs * 2**N`. Tests pass 0. */
  retryBaseMs?: number;
  /** Abort a single request that has produced no response in this long. */
  requestTimeoutMs?: number;
}

const PUSH_CHUNK_LIMIT = 200;

export class EntitySyncClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly requestTimeoutMs: number;

  constructor(private readonly options: EntitySyncClientOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
  }

  static get pushChunkLimit(): number {
    return PUSH_CHUNK_LIMIT;
  }

  async pull(since: number, limit = 500): Promise<SyncPullResult> {
    const url = `${this.endpoint}/sync/pull?since=${encodeURIComponent(String(since))}&limit=${encodeURIComponent(String(limit))}`;
    return this.requestJson<SyncPullResult>('GET', url);
  }

  async push(entities: SyncPushEntity[]): Promise<SyncPushResult> {
    if (entities.length > PUSH_CHUNK_LIMIT) {
      throw new EntitySyncError(
        `push() takes at most ${PUSH_CHUNK_LIMIT} entities; chunk the caller's list.`,
      );
    }
    return this.requestJson<SyncPushResult>('POST', `${this.endpoint}/sync/push`, { entities });
  }

  private async requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
    const token = await this.options.getToken();
    if (!token) {
      throw new EntitySyncAuthError('Not signed in to GitHub — connect an account first.', 401);
    }
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0) await delay(this.retryBaseMs * 2 ** (attempt - 1));
      let response: Response;
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (networkError) {
        lastError =
          networkError instanceof Error && networkError.name === 'AbortError'
            ? new EntitySyncError(`request timed out after ${this.requestTimeoutMs}ms`)
            : networkError;
        continue; // retry transient network / timeout failures
      } finally {
        clearTimeout(abortTimer);
      }

      if (response.ok) return (await response.json()) as T;

      const detail = await safeErrorText(response);
      if (response.status === 401 || response.status === 403) {
        throw new EntitySyncAuthError(detail, response.status);
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new EntitySyncError(detail, response.status);
        continue; // retry
      }
      throw new EntitySyncError(detail, response.status); // 4xx: not retryable
    }
    throw lastError instanceof Error
      ? new EntitySyncError(`sync request failed after retries: ${lastError.message}`)
      : new EntitySyncError('sync request failed after retries');
  }
}

const delay = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const safeErrorText = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // fall through
  }
  return `${response.status} ${response.statusText}`;
};
