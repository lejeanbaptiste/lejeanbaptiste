import { app } from 'electron';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  pluginArtifactUrl,
  pluginIndexUrl,
  parsePluginReleaseIndex,
  type PluginReleaseIndex,
} from '../../../commons/src/desktop/pluginRegistryTypes';
import { installPluginFromDirectory } from './pluginHost';

const MAX_PLUGIN_DOWNLOAD_BYTES = 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

async function downloadToFile(url: string, destination: string, maxBytes: number): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body)
    throw new Error(`HTTP ${response.status} downloading plugin.`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes)
    throw new Error('Plugin download exceeds the size limit.');
  let received = 0;
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    async function* (chunks) {
      for await (const chunk of chunks) {
        received += (chunk as Buffer).length;
        if (received > maxBytes) throw new Error('Plugin download exceeds the size limit.');
        yield chunk;
      }
    },
    fs.createWriteStream(destination),
  );
}

export const fetchRemotePluginIndex = async (): Promise<PluginReleaseIndex> => {
  const response = await fetch(pluginIndexUrl(), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not fetch plugin index (HTTP ${response.status}).`);
  const index = parsePluginReleaseIndex(await response.text());
  if (!index) throw new Error('Plugin index from GitHub is missing or malformed.');
  return index;
};

export async function installRemotePlugin(
  entry: PluginReleaseIndex['plugins'][number],
): Promise<void> {
  const tempRoot = path.join(app.getPath('userData'), '.grognard-plugin-download');
  const archivePath = path.join(tempRoot, entry.fileName);
  const extractRoot = path.join(tempRoot, 'extract');
  await fsp.rm(tempRoot, { recursive: true, force: true });
  await fsp.mkdir(extractRoot, { recursive: true });
  await downloadToFile(
    pluginArtifactUrl(entry.fileName),
    archivePath,
    Math.min(MAX_PLUGIN_DOWNLOAD_BYTES, entry.bytes + 64 * 1024 * 1024),
  );
  if ((await sha256File(archivePath)) !== entry.sha256)
    throw new Error('Downloaded plugin failed checksum verification.');

  const listing = await new Promise<string>((resolve, reject) => {
    const child = spawn('tar', ['-tzf', archivePath]);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code: number) =>
      code === 0 ? resolve(output) : reject(new Error('Could not inspect plugin archive.')),
    );
  });
  if (listing.split('\n').some((name) => name.startsWith('/') || name.split('/').includes('..')))
    throw new Error('Plugin archive contains unsafe paths.');
  await new Promise<void>((resolve, reject) =>
    execFile('tar', ['-xzf', archivePath, '-C', extractRoot], (error) =>
      error ? reject(error) : resolve(),
    ),
  );
  const sourceDir = path.join(extractRoot, entry.id);
  if (!fs.existsSync(path.join(sourceDir, 'plugin.manifest.json')))
    throw new Error('Plugin archive has no matching manifest.');
  await installPluginFromDirectory(sourceDir);
  await fsp.rm(tempRoot, { recursive: true, force: true });
}
