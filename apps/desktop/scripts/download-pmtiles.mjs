#!/usr/bin/env node
/** Download the pinned official extractor used for on-demand regional builds. */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const VERSION = '1.31.2';
const root = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(root, '../resources/pmtiles');
const platform = process.env.GROGNARD_PMTILES_PLATFORM || process.platform;
const arch = process.env.GROGNARD_PMTILES_ARCH || process.arch;
const osName = { darwin: 'Darwin', linux: 'Linux', win32: 'Windows' }[platform];
const archName = { arm64: 'arm64', x64: 'x86_64' }[arch];

if (!osName || !archName) {
  console.error(`[pmtiles] Unsupported target: ${platform}-${arch}`);
  process.exit(1);
}

const extension = platform === 'linux' ? 'tar.gz' : 'zip';
const asset =
  platform === 'darwin'
    ? `go-pmtiles-${VERSION}_${osName}_${archName}.${extension}`
    : `go-pmtiles_${VERSION}_${osName}_${archName}.${extension}`;
const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${VERSION}/${asset}`;
const binaryName = platform === 'win32' ? 'pmtiles.exe' : 'pmtiles';
const binaryPath = path.join(targetDir, binaryName);

if (existsSync(binaryPath)) {
  console.log(`[pmtiles] Already present: ${binaryPath}`);
  process.exit(0);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
const archivePath = path.join(targetDir, asset);
console.log(`[pmtiles] Downloading ${url}`);
const response = await fetch(url);
if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} downloading ${url}`);
await pipeline(response.body, createWriteStream(archivePath));
execFileSync('tar', ['-xf', archivePath, '-C', targetDir], { stdio: 'inherit' });
rmSync(archivePath, { force: true });

const findBinary = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(candidate);
      if (found) return found;
    } else if (entry.name === binaryName) return candidate;
  }
  return null;
};
const extractedPath = findBinary(targetDir);
if (!extractedPath) throw new Error(`Could not find ${binaryName} in ${asset}`);
if (extractedPath !== binaryPath) {
  writeFileSync(binaryPath, readFileSync(extractedPath));
  rmSync(path.dirname(extractedPath), { recursive: true, force: true });
}
if (platform !== 'win32') chmodSync(binaryPath, 0o755);
console.log(`[pmtiles] Installed: ${binaryPath}`);
