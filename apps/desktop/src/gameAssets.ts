/**
 * Loads the encrypted game-asset bundle (rank uniforms, battle-scene sheets)
 * shipped in resources/game-assets/assets.bin, decrypts it into memory, and
 * serves it to the renderer over the `ljb-asset://` scheme. Nothing is ever
 * written back to disk decrypted.
 *
 * This exists to keep unlock-progression artwork out of the public repo's
 * plain file browser, not to withstand a determined reverse-engineer: the
 * decryption key ships in ./generated/gameAssetKey.ts alongside this file.
 */

import { createDecipheriv } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, protocol } from 'electron';

import { getGameAssetKey } from './generated/gameAssetKey';

export const GAME_ASSET_SCHEME = 'ljb-asset';

export interface AssetColorStats {
  lightness: number;
  saturation: number;
}

interface AssetEntry {
  offset: number;
  length: number;
  type: string;
  colorStats?: AssetColorStats;
}

let assetMap: Map<string, { buffer: Buffer; type: string; colorStats?: AssetColorStats }> | null =
  null;

function getBundlePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'game-assets/assets.bin')
    : path.join(__dirname, '../resources/game-assets/assets.bin');
}

function loadAssetMap(): Map<string, { buffer: Buffer; type: string; colorStats?: AssetColorStats }> {
  if (assetMap) return assetMap;

  const bundlePath = getBundlePath();
  const raw = fs.readFileSync(bundlePath);
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', getGameAssetKey(), iv);
  decipher.setAuthTag(authTag);
  const payload = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  const indexLength = payload.readUInt32LE(0);
  const index: Record<string, AssetEntry> = JSON.parse(
    payload.subarray(4, 4 + indexLength).toString('utf8'),
  );
  const dataStart = 4 + indexLength;

  const map = new Map<string, { buffer: Buffer; type: string; colorStats?: AssetColorStats }>();
  for (const [key, entry] of Object.entries(index)) {
    map.set(key, {
      buffer: payload.subarray(dataStart + entry.offset, dataStart + entry.offset + entry.length),
      type: entry.type,
      colorStats: entry.colorStats,
    });
  }
  assetMap = map;
  return map;
}

export function registerGameAssetProtocol(): void {
  protocol.handle(GAME_ASSET_SCHEME, (request) => {
    try {
      const key = request.url.slice(`${GAME_ASSET_SCHEME}://`.length).replace(/\/+$/, '');
      const asset = loadAssetMap().get(key);
      if (!asset) return new Response(null, { status: 404 });
      const body = new Uint8Array(asset.buffer);
      return new Response(body, { headers: { 'content-type': asset.type } });
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}

/** Precomputed at pack time (see visual_design/scripts/pack-assets.mjs) -
 * never sampled at runtime, so there's no canvas/image-load involved. */
export function getGameAssetColorStats(key: string): AssetColorStats | null {
  try {
    return loadAssetMap().get(key)?.colorStats ?? null;
  } catch {
    return null;
  }
}

/** Raw decrypted bytes for one bundled asset - used by bodyAssets.ts, which
 * needs the actual body/poseN SVG source text to rewrite (toggling which
 * rank/weapon groups are visible) before serving it, unlike the other
 * `ljb-asset://` consumers that just display the bytes as-is. */
export function getGameAssetBuffer(key: string): Buffer | null {
  try {
    return loadAssetMap().get(key)?.buffer ?? null;
  } catch {
    return null;
  }
}
