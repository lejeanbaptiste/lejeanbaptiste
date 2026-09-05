#!/usr/bin/env node
/**
 * Downloads a relocatable CPython (python-build-standalone) and pip-installs
 * the pinned sanmiao and kanripo (pykanripo API) releases into it, so every
 * platform ships date tagging and single-juan Kanripo fetch with zero Python
 * setup.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { fetchWithRetry } from './retryable-fetch.mjs';

// https://github.com/astral-sh/python-build-standalone — "install_only" builds are relocatable.
const PBS_TAG = '20260623';
const PYTHON_VERSION = '3.12.13';
const SANMIAO_SPEC = 'sanmiao[fuzzy]==0.2.10';
const KANRIPO_API_SPEC = 'kanripo==0.31';

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

// Overridable via env vars rather than trusting process.platform/process.arch
// unconditionally: on some CI Windows arm64 runners, the node.exe that ends
// up invoking this script (see apps/desktop/package.json's prepackage:win,
// which hardcodes a system node.exe path for unrelated PATH reasons) can
// itself be an x64 build even though the runner and target installer are
// arm64 - process.arch would then silently report x64 and bundle the wrong
// Python/sanmiao build into the arm64 installer. This bit the Linux arm64
// build the same way (fixed by passing an explicit --arm64 electron-builder
// flag); CI sets these for the platform/arch it's actually packaging for.
const platform = process.env.GROGNARD_PYTHON_PLATFORM || process.platform;
const arch = process.env.GROGNARD_PYTHON_ARCH || process.arch;

// kanripo depends on PyGithub, whose `pyjwt[crypto]` extra pulls in
// cryptography, and cryptography does not publish a wheel for every target we
// package for: on Windows its only tag is win_amd64, and on macOS its only tag
// is macosx_11_0_arm64. For the targets below pip therefore falls back to a
// Rust + OpenSSL source build that the runner has no toolchain for. That extra
// only provides the RS256/ES256 JWT algorithms used for GitHub *App* auth;
// kanripo instead authenticates with a plain token (`Github(token)`), so
// nothing it imports or calls needs cryptography. On those targets we install
// the same dependency tree with the extra left out. PyGithub's other native
// dependency, pynacl, ships a win_arm64 wheel and a macOS universal2 wheel, so
// it installs normally everywhere.
const TARGETS_WITHOUT_CRYPTOGRAPHY_WHEEL = new Set(['win32-arm64', 'darwin-x64']);
const needsCryptoFreeKanripo = TARGETS_WITHOUT_CRYPTOGRAPHY_WHEEL.has(`${platform}-${arch}`);

/** PyGithub's declared requirements, with `pyjwt[crypto]` reduced to `pyjwt`. */
const PYGITHUB_DEPS_WITHOUT_CRYPTO = [
  'requests>=2.14.0',
  'pynacl>=1.4.0',
  'pyjwt>=2.4.0',
  'typing-extensions>=4.5.0',
  'urllib3>=1.26.0',
];

const target = TARGETS[`${platform}-${arch}`];
if (!target) {
  console.error(`[python-runtime] Unsupported platform: ${platform}-${arch}`);
  process.exit(1);
}

const asset = `cpython-${PYTHON_VERSION}+${PBS_TAG}-${target}-install_only.tar.gz`;
const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/${asset}`;

const pythonBin =
  process.platform === 'win32'
    ? path.join(RESOURCES_DIR, 'python.exe')
    : path.join(RESOURCES_DIR, 'bin', 'python3');
const stampPath = path.join(RESOURCES_DIR, '.deps-installed');
const stamp = `${asset} ${SANMIAO_SPEC} ${KANRIPO_API_SPEC}${
  needsCryptoFreeKanripo ? ' no-crypto' : ''
}`;

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
const response = await fetchWithRetry(url, undefined, { label: '[python-runtime] download' });
await pipeline(response.body, createWriteStream(tarPath));

console.log(`[python-runtime] Extracting ${asset}`);
// Tarball root is python/ — strip it so bin/ (or python.exe) lands directly in
// RESOURCES_DIR. Windows 10+ ships bsdtar as tar.exe, which handles .tar.gz.
execFileSync('tar', ['-xzf', tarPath, '-C', RESOURCES_DIR, '--strip-components=1'], {
  stdio: 'inherit',
});
unlinkSync(tarPath);

const pipInstall = (specs, extraArgs = []) =>
  execFileSync(
    pythonBin,
    [
      '-m',
      'pip',
      'install',
      '--no-warn-script-location',
      '--disable-pip-version-check',
      '--retries',
      '5',
      '--timeout',
      '60',
      ...extraArgs,
      ...specs,
    ],
    { stdio: 'inherit' },
  );

console.log(`[python-runtime] Installing ${SANMIAO_SPEC}`);
pipInstall([SANMIAO_SPEC]);

console.log(`[python-runtime] Installing ${KANRIPO_API_SPEC}`);
if (needsCryptoFreeKanripo) {
  // Install kanripo and PyGithub without letting pip resolve `pyjwt[crypto]`,
  // then supply PyGithub's requirements explicitly minus that extra.
  console.log(`[python-runtime] ${platform}-${arch}: installing without the pyjwt[crypto] extra`);
  pipInstall([KANRIPO_API_SPEC, 'PyGithub'], ['--no-deps']);
  pipInstall(PYGITHUB_DEPS_WITHOUT_CRYPTO);
} else {
  pipInstall([KANRIPO_API_SPEC]);
}

writeFileSync(stampPath, `${stamp}\n`);
console.log(`[python-runtime] Ready: ${pythonBin}`);
