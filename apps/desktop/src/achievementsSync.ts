/**
 * Sync the encrypted achievements.json blob through the entity-sync Worker.
 * Runs after entity sync on the same timer; opaque bytes only — merge happens
 * client-side after decrypt.
 */
import { app } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  decryptAchievementsEnvelope,
  readAchievementsFileRaw,
  writeAchievementsEnvelopeRaw,
  writeAchievementsFile,
} from './achievementsFile';
import { mergeAchievementsPlaintext } from './achievementsMerge';
import type { EntitySyncClient } from './entitySyncClient';

const MARKER_FILENAME = 'entity-sync-achievements-marker.json';

export interface AchievementsSyncMarker {
  revision: number;
  sha256: string;
}

export interface AchievementsSyncResult {
  pulled: boolean;
  pushed: boolean;
  revision: number;
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const getMarkerPath = () => path.join(app.getPath('userData'), MARKER_FILENAME);

const readMarker = async (): Promise<AchievementsSyncMarker> => {
  try {
    const parsed = JSON.parse(
      await fs.readFile(getMarkerPath(), 'utf-8'),
    ) as Partial<AchievementsSyncMarker>;
    return {
      revision:
        typeof parsed.revision === 'number' && Number.isInteger(parsed.revision)
          ? Math.max(0, parsed.revision)
          : 0,
      sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : '',
    };
  } catch {
    return { revision: 0, sha256: '' };
  }
};

const writeMarker = async (marker: AchievementsSyncMarker): Promise<void> => {
  const markerPath = getMarkerPath();
  await fs.mkdir(path.dirname(markerPath), { recursive: true });
  await fs.writeFile(`${markerPath}.tmp`, JSON.stringify(marker, null, 2));
  await fs.rename(`${markerPath}.tmp`, markerPath);
};

type AchievementsClient = Pick<EntitySyncClient, 'getAchievements' | 'putAchievements'>;

const mergeRemoteWithLocal = async (remoteBlob: string, localRaw: string | null): Promise<void> => {
  const remotePlain = decryptAchievementsEnvelope(remoteBlob);
  const localPlain = localRaw ? decryptAchievementsEnvelope(localRaw) : null;
  if (remotePlain && localPlain) {
    await writeAchievementsFile(mergeAchievementsPlaintext(remotePlain, localPlain));
    return;
  }
  if (remotePlain && !localPlain) {
    await writeAchievementsEnvelopeRaw(remoteBlob);
  }
};

export const runAchievementsSync = async (
  client: AchievementsClient,
): Promise<AchievementsSyncResult> => {
  let marker = await readMarker();
  let localRaw = await readAchievementsFileRaw();
  const remote = await client.getAchievements();

  if (remote) {
    const localSha = sha256(localRaw ?? '');
    const shouldMerge =
      remote.revision !== marker.revision ||
      remote.sha256 !== marker.sha256 ||
      remote.sha256 !== localSha;
    if (shouldMerge) {
      await mergeRemoteWithLocal(remote.blob, localRaw);
      localRaw = await readAchievementsFileRaw();
    }
    if (localRaw && sha256(localRaw) === sha256(remote.blob)) {
      marker = { revision: remote.revision, sha256: sha256(localRaw) };
      await writeMarker(marker);
      return { pulled: true, pushed: false, revision: marker.revision };
    }
  }

  if (!localRaw) {
    if (remote) {
      marker = { revision: remote.revision, sha256: remote.sha256 };
      await writeMarker(marker);
    }
    return { pulled: Boolean(remote), pushed: false, revision: marker.revision };
  }

  const localSha = sha256(localRaw);
  if (localSha === marker.sha256 && remote && remote.revision === marker.revision) {
    return { pulled: Boolean(remote), pushed: false, revision: marker.revision };
  }

  let baseRevision = marker.revision;
  let response = await client.putAchievements({ baseRevision, blob: localRaw });

  for (let attempt = 0; attempt < 3 && 'conflict' in response && response.conflict; attempt += 1) {
    await mergeRemoteWithLocal(response.serverBlob, localRaw);
    localRaw = await readAchievementsFileRaw();
    if (!localRaw) break;
    baseRevision = response.serverRevision;
    response = await client.putAchievements({ baseRevision, blob: localRaw });
  }

  if ('applied' in response && response.applied) {
    marker = { revision: response.revision, sha256: response.sha256 };
    await writeMarker(marker);
    return { pulled: Boolean(remote), pushed: true, revision: marker.revision };
  }

  return { pulled: Boolean(remote), pushed: false, revision: marker.revision };
};

/** Exported for tests. */
export const __testing = { sha256, mergeRemoteWithLocal, readMarker, writeMarker };
