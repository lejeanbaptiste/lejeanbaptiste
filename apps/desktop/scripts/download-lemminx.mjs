#!/usr/bin/env node
/**
 * Downloads the LemMinX binary matching vscode-xml release (same engine as Red Hat XML extension).
 * macOS is supported today; Windows is intentionally skipped until we wire a Windows binary source.
 */
import { chmodSync, createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const LEMMINX_VERSION = '0.29.3';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/lemminx');

const platformMap = {
  darwin: {
    arm64: { asset: 'lemminx-osx-aarch_64.zip', binary: 'lemminx-osx-aarch_64' },
    x64: { asset: 'lemminx-osx-x86_64.zip', binary: 'lemminx-osx-x86_64' },
  },
};

const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

if (platform !== 'darwin') {
  console.log(
    `[lemminx] Skipping download on ${platform} (Windows/Linux binary source not wired yet).`,
  );
  process.exit(0);
}

const config = platformMap[platform]?.[arch];
if (!config) {
  console.error(`[lemminx] Unsupported platform: ${platform} ${arch}`);
  process.exit(1);
}

mkdirSync(RESOURCES_DIR, { recursive: true });

const binaryPath = path.join(RESOURCES_DIR, config.binary);
if (existsSync(binaryPath)) {
  console.log(`[lemminx] Already present: ${binaryPath}`);
  process.exit(0);
}

const url = `https://github.com/redhat-developer/vscode-xml/releases/download/${LEMMINX_VERSION}/${config.asset}`;
const zipPath = path.join(RESOURCES_DIR, config.asset);

console.log(`[lemminx] Downloading ${url}`);

const response = await fetch(url);
if (!response.ok) {
  console.error(`[lemminx] Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

await pipeline(response.body, createWriteStream(zipPath));

console.log(`[lemminx] Extracting ${zipPath}`);
execSync(`unzip -o -j "${zipPath}" -d "${RESOURCES_DIR}"`, { stdio: 'inherit' });

unlinkSync(zipPath);
chmodSync(binaryPath, 0o755);

console.log(`[lemminx] Ready: ${binaryPath}`);
