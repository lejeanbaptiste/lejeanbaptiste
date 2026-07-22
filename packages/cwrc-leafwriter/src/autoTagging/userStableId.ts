/**
 * The stable per-user id used as the `subtype` on `ljb-central` concordance
 * rows. It is minted once and stored inside the central entity-database folder
 * (`{entityDbFolder}/user-id.txt`) — NOT Electron `userData` — so that when the
 * scholar roams that folder via Dropbox/iCloud, the same id follows them to
 * every machine. Minting it per-machine would split one scholar into two rows
 * on every linked entity, defeating the whole point of the concordance.
 */

import type { EntityFileApi } from './entityStore';
import { joinPath } from './pathJoin';

export const USER_ID_FILE = 'user-id.txt';

/** Mint a fresh stable user id (UUID v4 when available). */
export function generateUserStableId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `user-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export interface UserStableIdResult {
  id: string;
  /** True when this call minted and persisted a new id (first run on this folder). */
  minted: boolean;
}

/**
 * Read the user's stable id from `{entityDbFolder}/user-id.txt`, minting and
 * persisting one on first use. A blank/whitespace file is treated as absent and
 * re-minted. When `entityDbFolder` is null (no central folder configured yet),
 * a session-local id is returned without touching disk; the caller should
 * re-run once a folder is set so the id can be persisted there.
 */
export async function readOrMintUserStableId(
  api: EntityFileApi,
  entityDbFolder: string | null,
): Promise<UserStableIdResult> {
  if (!entityDbFolder) {
    return { id: generateUserStableId(), minted: false };
  }
  const filePath = joinPath(entityDbFolder, USER_ID_FILE);
  if (await api.pathExists(filePath)) {
    const existing = (await api.readFile(filePath)).trim();
    if (existing) return { id: existing, minted: false };
  }
  const id = generateUserStableId();
  await api.ensureDirectory(entityDbFolder);
  await api.writeFile(filePath, `${id}\n`);
  return { id, minted: true };
}
