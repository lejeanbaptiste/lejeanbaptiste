#!/usr/bin/env node
/**
 * Downloads the LemMinX binary matching vscode-xml release (same engine as Red Hat XML extension).
 * macOS is supported today; Windows is intentionally skipped until we wire a Windows binary source.
 */
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { fetchWithRetry } from './retryable-fetch.mjs';

const LEMMINX_VERSION = '0.29.3';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/lemminx');

const platformMap = {
  darwin: {
    arm64: { asset: 'lemminx-osx-aarch_64.zip', binary: 'lemminx-osx-aarch_64' },
    x64: { asset: 'lemminx-osx-x86_64.zip', binary: 'lemminx-osx-x86_64' },
  },
};

// Overridable via env vars rather than trusting process.platform/process.arch:
// the macOS x64 package is cross-built on an arm64 runner, where process.arch
// reports arm64 and would silently bundle the wrong-arch language server into
// the Intel app. Mirrors GROGNARD_PYTHON_* / GROGNARD_PMTILES_*; CI sets these for the
// platform/arch it is actually packaging for.
const platform = process.env.GROGNARD_LEMMINX_PLATFORM || process.platform;
const arch = (process.env.GROGNARD_LEMMINX_ARCH || process.arch) === 'arm64' ? 'arm64' : 'x64';

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

const binaryPath = path.join(RESOURCES_DIR, config.binary);
const stampPath = path.join(RESOURCES_DIR, '.lemminx-version');
const stamp = `${LEMMINX_VERSION} ${config.asset}`;

if (
  existsSync(binaryPath) &&
  existsSync(stampPath) &&
  readFileSync(stampPath, 'utf-8').trim() === stamp
) {
  console.log(`[lemminx] Already present: ${binaryPath}`);
  process.exit(0);
}

const url = `https://github.com/redhat-developer/vscode-xml/releases/download/${LEMMINX_VERSION}/${config.asset}`;
const zipPath = path.join(RESOURCES_DIR, config.asset);

rmSync(RESOURCES_DIR, { recursive: true, force: true });
mkdirSync(RESOURCES_DIR, { recursive: true });

console.log(`[lemminx] Downloading ${url}`);
const response = await fetchWithRetry(url, undefined, { label: '[lemminx] download' });

await pipeline(response.body, createWriteStream(zipPath));

console.log(`[lemminx] Extracting ${zipPath}`);
execSync(`unzip -o -j "${zipPath}" -d "${RESOURCES_DIR}"`, { stdio: 'inherit' });

unlinkSync(zipPath);
chmodSync(binaryPath, 0o755);
writeFileSync(stampPath, `${stamp}\n`);

console.log(`[lemminx] Ready: ${binaryPath}`);
