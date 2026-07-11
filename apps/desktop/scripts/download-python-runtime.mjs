#!/usr/bin/env node
/**
 * Downloads a relocatable CPython (python-build-standalone) and pip-installs
 * the pinned sanmiao release into it, so every platform ships date tagging
 * with zero Python setup — and every dev machine/VM self-provisions the same
 * runtime at the same repo-relative path (apps/desktop/resources/python).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

// https://github.com/astral-sh/python-build-standalone — "install_only" builds are relocatable.
const PBS_TAG = '20260623';
const PYTHON_VERSION = '3.12.13';
const SANMIAO_SPEC = 'sanmiao[fuzzy]==0.2.10';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/python');

const TARGETS = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'win32-x64': 'x86_64-pc-windows-msvc',
};

const target = TARGETS[`${process.platform}-${process.arch}`];
if (!target) {
  console.error(`[python-runtime] Unsupported platform: ${process.platform}-${process.arch}`);
  process.exit(1);
}

const asset = `cpython-${PYTHON_VERSION}+${PBS_TAG}-${target}-install_only.tar.gz`;
const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/${asset}`;

const pythonBin =
  process.platform === 'win32'
    ? path.join(RESOURCES_DIR, 'python.exe')
    : path.join(RESOURCES_DIR, 'bin', 'python3');
const stampPath = path.join(RESOURCES_DIR, '.deps-installed');
const stamp = `${asset} ${SANMIAO_SPEC}`;

if (
  existsSync(pythonBin) &&
  existsSync(stampPath) &&
  readFileSync(stampPath, 'utf-8').trim() === stamp
) {
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
// Tarball root is python/ — strip it so bin/ (or python.exe) lands directly in
// RESOURCES_DIR. Windows 10+ ships bsdtar as tar.exe, which handles .tar.gz.
execFileSync('tar', ['-xzf', tarPath, '-C', RESOURCES_DIR, '--strip-components=1'], {
  stdio: 'inherit',
});
unlinkSync(tarPath);

console.log(`[python-runtime] Installing ${SANMIAO_SPEC}`);
execFileSync(
  pythonBin,
  ['-m', 'pip', 'install', '--no-warn-script-location', '--disable-pip-version-check', SANMIAO_SPEC],
  { stdio: 'inherit' },
);

writeFileSync(stampPath, `${stamp}\n`);
console.log(`[python-runtime] Ready: ${pythonBin}`);
