#!/usr/bin/env node
/**
 * Build release zips for the LJB corpus-import browser extension.
 *
 * Output (under apps/desktop/release/ by default):
 *   ljb-browser-extension-chromium-<version>.zip
 *   ljb-browser-extension-firefox-<version>.zip
 *
 * Each zip unpacks to a single top-level folder ready for "Load unpacked"
 * (Chromium) or "Load Temporary Add-on" (Firefox).
 *
 * Usage:
 *   node scripts/package-browser-extension.mjs [version]
 *
 * Version defaults to apps/browser-extension/manifest.json. In CI, pass the
 * desktop release tag (with or without a leading `v`) so the asset names match
 * the GitHub release.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'apps', 'browser-extension');
const defaultOutDir = path.join(repoRoot, 'apps', 'desktop', 'release');

const CHROMIUM_FILES = [
  'content.js',
  'content-kanripo.js',
  'content-bdrc.js',
  'popup.html',
  'popup.js',
  'manifest.json',
];

const normalizeVersion = (raw) => {
  const trimmed = (raw ?? '').trim().replace(/^v/, '');
  if (!trimmed) return null;
  return trimmed;
};

const readManifestVersion = async () => {
  const manifestPath = path.join(extensionRoot, 'manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error(`Missing version in ${manifestPath}`);
  }
  return manifest.version.trim();
};

const copyPath = async (source, dest) => {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.cp(source, dest, { recursive: true });
};

const stageChromium = async (stageDir) => {
  for (const name of CHROMIUM_FILES) {
    await copyPath(path.join(extensionRoot, name), path.join(stageDir, name));
  }
  await copyPath(path.join(extensionRoot, 'icons'), path.join(stageDir, 'icons'));
};

const stageFirefox = async (stageDir) => {
  for (const name of [
    'content.js',
    'content-kanripo.js',
    'content-bdrc.js',
    'popup.html',
    'popup.js',
  ]) {
    await copyPath(path.join(extensionRoot, name), path.join(stageDir, name));
  }
  await copyPath(path.join(extensionRoot, 'icons'), path.join(stageDir, 'icons'));
  await copyPath(
    path.join(extensionRoot, 'manifest.firefox.json'),
    path.join(stageDir, 'manifest.json'),
  );
};

const zipDirectory = async (sourceDir, zipPath) => {
  await fsp.mkdir(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) await fsp.unlink(zipPath);
  // Zip the folder itself so `unzip` yields one directory to pick in the browser.
  const parent = path.dirname(sourceDir);
  const base = path.basename(sourceDir);
  await execFileAsync('zip', ['-rq', zipPath, base], { cwd: parent });
};

const main = async () => {
  const version =
    normalizeVersion(process.argv[2]) ?? normalizeVersion(await readManifestVersion());
  if (!version) {
    throw new Error('Could not determine extension release version');
  }

  const outDir = path.resolve(process.env.LJB_BROWSER_EXTENSION_OUT_DIR ?? defaultOutDir);
  const workDir = path.join(outDir, `.browser-extension-staging-${version}`);
  const chromiumDir = path.join(workDir, `ljb-browser-extension-chromium-${version}`);
  const firefoxDir = path.join(workDir, `ljb-browser-extension-firefox-${version}`);
  const chromiumZip = path.join(outDir, `ljb-browser-extension-chromium-${version}.zip`);
  const firefoxZip = path.join(outDir, `ljb-browser-extension-firefox-${version}.zip`);

  await fsp.rm(workDir, { recursive: true, force: true });
  await fsp.mkdir(workDir, { recursive: true });

  await stageChromium(chromiumDir);
  await stageFirefox(firefoxDir);
  await zipDirectory(chromiumDir, chromiumZip);
  await zipDirectory(firefoxDir, firefoxZip);
  await fsp.rm(workDir, { recursive: true, force: true });

  process.stdout.write(`Wrote ${chromiumZip}\n`);
  process.stdout.write(`Wrote ${firefoxZip}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
