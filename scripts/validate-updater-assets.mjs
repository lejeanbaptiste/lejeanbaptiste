import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { load } from 'js-yaml';

const [assetDirectory, expectedVersion] = process.argv.slice(2);
if (!assetDirectory || !expectedVersion) {
  throw new Error('Usage: validate-updater-assets.mjs <asset-directory> <expected-version>');
}

const names = await readdir(assetDirectory);
const matching = (pattern) => names.filter((name) => pattern.test(name));
const requireCount = (label, pattern, count) => {
  const found = matching(pattern);
  if (found.length !== count)
    throw new Error(`Expected ${count} ${label}; found ${found.join(', ') || 'none'}`);
};

requireCount('macOS ZIPs', /^Le-Jean-Baptiste-.*-(?:arm64|x64)\.zip$/, 2);
requireCount('macOS ZIP blockmaps', /^Le-Jean-Baptiste-.*-(?:arm64|x64)\.zip\.blockmap$/, 2);
requireCount('Windows installers', /^Le-Jean-Baptiste-Setup-.*-(?:arm64|x64)\.exe$/, 2);
requireCount(
  'Windows installer blockmaps',
  /^Le-Jean-Baptiste-Setup-.*-(?:arm64|x64)\.exe\.blockmap$/,
  2,
);

for (const metadataName of ['latest-mac.yml', 'latest.yml']) {
  const metadata = load(await readFile(path.join(assetDirectory, metadataName), 'utf8'));
  if (metadata.version !== expectedVersion) {
    throw new Error(`${metadataName} has version ${metadata.version}; expected ${expectedVersion}`);
  }
  if (!Array.isArray(metadata.files) || metadata.files.length === 0) {
    throw new Error(`${metadataName} does not list update files`);
  }
  for (const architecture of ['arm64', 'x64']) {
    if (!metadata.files.some(({ url }) => url.includes(architecture))) {
      throw new Error(`${metadataName} does not list an ${architecture} update file`);
    }
  }
  for (const file of metadata.files) {
    await access(path.join(assetDirectory, path.basename(file.url)));
  }
}

process.stdout.write(`Updater assets for ${expectedVersion} are complete\n`);
