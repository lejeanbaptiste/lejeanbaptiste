import {
  parseAchievementsPut,
  type AchievementsGetResponse,
  type AchievementsPutResponse,
} from './achievementsProtocol';

interface StoredAchievements {
  revision: number;
  blob: string;
  sha256: string;
  updated_at: string;
}

const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export async function handleAchievementsGet(
  db: D1Database,
  ownerId: string,
): Promise<AchievementsGetResponse | null> {
  const row = await db
    .prepare('SELECT revision, blob, sha256, updated_at FROM achievements_blob WHERE owner_id = ?')
    .bind(ownerId)
    .first<StoredAchievements>();
  if (!row) return null;
  return {
    revision: row.revision,
    blob: row.blob,
    sha256: row.sha256,
    updatedAt: row.updated_at,
  };
}

export async function handleAchievementsPut(
  db: D1Database,
  ownerId: string,
  baseRevision: number,
  blob: string,
): Promise<AchievementsPutResponse> {
  const sha256 = await sha256Hex(blob);
  const now = new Date().toISOString();

  const existing = await db
    .prepare('SELECT revision, blob, sha256 FROM achievements_blob WHERE owner_id = ?')
    .bind(ownerId)
    .first<StoredAchievements>();

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO achievements_blob (owner_id, revision, blob, sha256, updated_at)
         VALUES (?, 1, ?, ?, ?)`,
      )
      .bind(ownerId, blob, sha256, now)
      .run();
    return { applied: true, revision: 1, sha256 };
  }

  if (existing.revision !== baseRevision) {
    return {
      conflict: true,
      serverRevision: existing.revision,
      serverBlob: existing.blob,
      serverSha256: existing.sha256,
    };
  }

  const nextRevision = existing.revision + 1;
  await db
    .prepare(
      `UPDATE achievements_blob
          SET revision = ?, blob = ?, sha256 = ?, updated_at = ?
        WHERE owner_id = ? AND revision = ?`,
    )
    .bind(nextRevision, blob, sha256, now, ownerId, baseRevision)
    .run();

  return { applied: true, revision: nextRevision, sha256 };
}

export { parseAchievementsPut };
