#!/usr/bin/env node
/**
 * Downloads a relocatable CPython (python-build-standalone) and preinstalls the
 * Sanmiao runtime deps, so macOS users get date tagging with zero Python setup.
 * macOS only: the Linux .deb declares distro python3-* packages instead.
 */
import { existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// https://github.com/astral-sh/python-build-standalone — "install_only" builds are relocatable.
const PBS_TAG = '20241016';
const PYTHON_VERSION = '3.12.7';
const SANMIAO_DEPS = ['pandas', 'numpy', 'lxml'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/python');

const platform = process.platform;
if (platform !== 'darwin') {
  console.log(`[python-runtime] Skipping download on ${platform} (macOS only; Linux uses apt deps).`);
  process.exit(0);
}

const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const asset = `cpython-${PYTHON_VERSION}+${PBS_TAG}-${arch}-apple-darwin-install_only.tar.gz`;
const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/${asset}`;

const pythonBin = path.join(RESOURCES_DIR, 'bin', 'python3');
const stampPath = path.join(RESOURCES_DIR, '.deps-installed');

if (existsSync(pythonBin) && existsSync(stampPath)) {
  console.log(`[python-runtime] Already present: ${pythonBin}`);
  process.exit(0);
}

rmSync(RESOURCES_DIR, { recursive: true, force: true });
mkdirSync(RESOURCES_DIR, { recursive: true });

const tarPath = path.join(RESOURCES_DIR, asset);
console.log(`[python-runtime] Downloading ${url}`);
const response = await fetch(url);
if (!response.ok) {
  console.error(`[python-runtime] Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
await pipeline(response.body, createWriteStream(tarPath));

console.log(`[python-runtime] Extracting ${asset}`);
// Tarball root is python/ — strip it so bin/ lands directly in RESOURCES_DIR.
execSync(`tar -xzf "${tarPath}" -C "${RESOURCES_DIR}" --strip-components=1`, { stdio: 'inherit' });
unlinkSync(tarPath);

console.log(`[python-runtime] Installing Sanmiao deps: ${SANMIAO_DEPS.join(', ')}`);
execSync(
  `"${pythonBin}" -m pip install --no-warn-script-location --disable-pip-version-check ${SANMIAO_DEPS.join(' ')}`,
  { stdio: 'inherit' },
);

execSync(`touch "${stampPath}"`);
console.log(`[python-runtime] Ready: ${pythonBin}`);
