#!/usr/bin/env node
/**
 * Downloads the CHGIS compile toolchain (pure-JS source + shapefile/proj4/sax,
 * no better-sqlite3) built by authority-extraction's chgis-toolchain:release
 * script, so packaged installs can compile CHGIS locally after the user
 * downloads raw shapefiles from Dataverse — CHGIS's license forbids shipping
 * compiled packs (see authorityChgis.ts / authorityCompile.ts), so LJB never
 * bundles CHGIS data, only the compiler.
 *
 * Bundled at apps/desktop/resources/authority-extraction (see
 * electron-builder.base.json extraResources and authorityCompile.ts's
 * resolveAuthorityExtractionRoot, which looks under resourcesPath first).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { fetchWithRetry } from './retryable-fetch.mjs';

// Bump alongside a new authority-extraction release tag (its build-packs.yml
// workflow runs `npm run chgis-toolchain:release` on every `v*` tag push).
const TOOLCHAIN_VERSION = 'v0.1.8';
const asset = `chgis-toolchain-${TOOLCHAIN_VERSION}.tar.gz`;
const url = `https://github.com/lejeanbaptiste/authoritypacks/releases/download/${TOOLCHAIN_VERSION}/${asset}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, '../resources/authority-extraction');
const stampPath = path.join(RESOURCES_DIR, '.version');
const compileScript = path.join(RESOURCES_DIR, 'chgis/compile.mjs');
const packageJsonPath = path.join(RESOURCES_DIR, 'package.json');
const nodeModulesPath = path.join(RESOURCES_DIR, 'node_modules');

const installToolchainDependencies = () => {
  if (existsSync(nodeModulesPath)) return;
  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `The downloaded CHGIS toolchain is missing package.json: ${packageJsonPath}`,
    );
  }

  // The compiler is run by Electron with ELECTRON_RUN_AS_NODE in the installed
  // app. It cannot depend on a user's Node/npm installation, so its runtime
  // dependencies must be installed into this staged resource before packaging.
  const npm =
    process.platform === 'win32' ? path.join(path.dirname(process.execPath), 'npm.cmd') : 'npm';
  const hasLockfile = existsSync(path.join(RESOURCES_DIR, 'package-lock.json'));
  const args = hasLockfile
    ? ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund']
    : ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'];
  console.log(`[authority-extraction] Installing bundled compiler dependencies (${args[0]})`);
  execFileSync(npm, args, { cwd: RESOURCES_DIR, stdio: 'inherit' });

  if (!existsSync(nodeModulesPath)) {
    throw new Error('CHGIS compiler dependency installation did not create node_modules.');
  }
};

if (
  existsSync(compileScript) &&
  existsSync(stampPath) &&
  readFileSync(stampPath, 'utf-8').trim() === TOOLCHAIN_VERSION
) {
  installToolchainDependencies();
  console.log(`[authority-extraction] Already present: ${RESOURCES_DIR} (${TOOLCHAIN_VERSION})`);
  process.exit(0);
}

rmSync(RESOURCES_DIR, { recursive: true, force: true });
mkdirSync(RESOURCES_DIR, { recursive: true });

const tarPath = path.join(RESOURCES_DIR, asset);
console.log(`[authority-extraction] Downloading ${url}`);
const response = await fetchWithRetry(url, undefined, { label: '[authority-extraction] download' });
await pipeline(response.body, createWriteStream(tarPath));

console.log(`[authority-extraction] Extracting ${asset}`);
execFileSync('tar', ['-xzf', tarPath, '-C', RESOURCES_DIR], { stdio: 'inherit' });
rmSync(tarPath, { force: true });

installToolchainDependencies();
writeFileSync(stampPath, `${TOOLCHAIN_VERSION}\n`);
console.log(`[authority-extraction] Ready: ${compileScript}`);
