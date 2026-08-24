#!/usr/bin/env node
/**
 * Fetches apps/desktop/resources/game-assets/assets.bin from the
 * leaf-writer-game-assets Cloudflare R2 bucket, replacing the old
 * `git lfs pull --include=".../assets.bin"` CI step. The binary itself is
 * no longer committed (LFS bandwidth on the 10GB/mo free tier was maxed
 * out by CI re-pulling the ~63MB+ file on every matrix job/release
 * platform); what's committed instead is assets.manifest.json - a
 * {version, sha256} pointer written by visual_design's pack-assets.mjs
 * (see uploadAssetsToR2 there) whenever the pack is regenerated and R2
 * credentials are present.
 *
 * The R2 object is content-addressed by its own sha256
 * (`assets/<sha256>.bin`), so this script downloads it and re-verifies the
 * hash locally before ever touching the destination path - a corrupted or
 * truncated download fails loudly here rather than shipping a build with a
 * broken (or, worse, silently wrong) asset bundle.
 *
 * Usage: node scripts/fetch-game-assets.mjs
 * Requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 * R2_ENDPOINT in the environment (the same four CI secrets already used by
 * visual_design's upload side).
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  ROOT,
  'apps/desktop/resources/game-assets/assets.manifest.json',
);
const OUT_BIN = path.join(ROOT, 'apps/desktop/resources/game-assets/assets.bin');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set - required to fetch game assets from R2`);
  }
  return value;
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing ${MANIFEST_PATH} - run visual_design's pack-assets.mjs first`);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!manifest.sha256 || typeof manifest.sha256 !== 'string') {
    throw new Error(`${MANIFEST_PATH} is missing a valid "sha256" field: ${JSON.stringify(manifest)}`);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
  const bucket = requireEnv('R2_BUCKET_NAME');
  const key = `assets/${manifest.sha256}.bin`;

  console.log(`Fetching ${key} from R2 bucket ${bucket} (manifest version ${manifest.version})...`);
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = Buffer.from(await response.Body.transformToByteArray());

  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== manifest.sha256) {
    throw new Error(
      `Downloaded ${key} does not match the manifest: expected sha256 ${manifest.sha256}, got ${actualSha256}`,
    );
  }

  mkdirSync(path.dirname(OUT_BIN), { recursive: true });
  writeFileSync(OUT_BIN, bytes);
  console.log(`Wrote ${bytes.length} bytes to ${OUT_BIN} (sha256 verified).`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
