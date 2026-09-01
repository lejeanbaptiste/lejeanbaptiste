/** Wire types for opaque achievements blob sync (encrypted file bytes). */

export const MAX_ACHIEVEMENTS_BLOB_LENGTH = 500_000;

export interface AchievementsGetResponse {
  revision: number;
  blob: string;
  sha256: string;
  updatedAt: string;
}

export interface AchievementsPutRequest {
  /** Central revision the client last synced (0 when never synced). */
  baseRevision: number;
  /** Raw on-disk file contents (encrypted envelope JSON). */
  blob: string;
}

export interface AchievementsPutApplied {
  applied: true;
  revision: number;
  sha256: string;
}

export interface AchievementsPutConflict {
  conflict: true;
  serverRevision: number;
  serverBlob: string;
  serverSha256: string;
}

export type AchievementsPutResponse = AchievementsPutApplied | AchievementsPutConflict;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isNonNegInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function parseAchievementsPut(raw: unknown): ParseResult<AchievementsPutRequest> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const body = raw as Record<string, unknown>;
  if (!isNonNegInt(body.baseRevision)) {
    return { ok: false, error: '`baseRevision` must be a non-negative integer.' };
  }
  if (typeof body.blob !== 'string' || body.blob.length === 0) {
    return { ok: false, error: '`blob` must be a non-empty string.' };
  }
  if (body.blob.length > MAX_ACHIEVEMENTS_BLOB_LENGTH) {
    return { ok: false, error: `blob exceeds max length (${MAX_ACHIEVEMENTS_BLOB_LENGTH}).` };
  }
  return { ok: true, value: { baseRevision: body.baseRevision, blob: body.blob } };
}
