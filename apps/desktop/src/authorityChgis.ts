/**
 * CHGIS local install: extract user download → compile tagging pack.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';

import {
  CHGIS_MANIFEST_FILENAME,
  CHGIS_RAW_SUBDIR,
  type ChgisInstallProgress,
  type ChgisInstallResult,
  type ChgisStatus,
} from '../../commons/src/desktop/authorityChgisTypes';
import { AUTHORITY_PACKS_DIRNAME } from '../../commons/src/desktop/authorityPackTypes';
import { AUTHORITY_DB_DIRNAME } from './authorityDatabases';
import { resolveAuthorityExtractionRoot } from './authorityCompile';

const execFileAsync = promisify(execFile);
const COMPILE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 20_000;

let chgisBusy = false;

const chgisRawRoot = (entityDbFolder: string): string =>
  path.join(entityDbFolder, AUTHORITY_DB_DIRNAME, CHGIS_RAW_SUBDIR);

const chgisManifestPath = (entityDbFolder: string): string =>
  path.join(entityDbFolder, AUTHORITY_DB_DIRNAME, CHGIS_MANIFEST_FILENAME);

const chgisPackDir = (entityDbFolder: string): string =>
  path.join(entityDbFolder, AUTHORITY_PACKS_DIRNAME, 'chgis');

/**
 * Packs/databases live in the local per-machine authority-assets folder
 * (see getLocalAuthorityAssetsDir), not inside the project's entities.xml
 * folder — that folder is always created on demand and never depends on
 * entities.xml existing. "Ready" here just means a folder was resolved.
 */
export const entityDbFolderReady = (entityDbFolder: string | null): boolean =>
  !!entityDbFolder?.trim();

const sumDirectoryBytes = async (dirPath: string): Promise<number> => {
  let total = 0;
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) total += await sumDirectoryBytes(full);
      else if (entry.isFile()) total += (await fsp.stat(full)).size;
    }
  } catch {
    return 0;
  }
  return total;
};

const readPackManifest = (entityDbFolder: string) => {
  const manifestPath = path.join(chgisPackDir(entityDbFolder), 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      files?: { 'places.ndjson'?: { entityCount?: number; crosswalkCount?: number } };
      policy?: { layers?: string[] };
      compiledAt?: string;
      upstream?: { input?: string };
    };
  } catch {
    return null;
  }
};

export const getChgisStatus = async (entityDbFolder: string | null): Promise<ChgisStatus> => {
  const ready = entityDbFolderReady(entityDbFolder);
  if (!ready || !entityDbFolder) {
    return {
      installed: false,
      entityDbFolder,
      entityDbReady: false,
      busy: chgisBusy,
    };
  }

  const packManifest = readPackManifest(entityDbFolder);
  const placesFile = path.join(chgisPackDir(entityDbFolder), 'places.ndjson');
  const installed = fs.existsSync(placesFile);

  let lifecycle: { installedAt?: string; sourceArchive?: string; lastError?: string } = {};
  try {
    lifecycle = JSON.parse(await fsp.readFile(chgisManifestPath(entityDbFolder), 'utf8'));
  } catch {
    lifecycle = {};
  }

  const rawBytes = await sumDirectoryBytes(chgisRawRoot(entityDbFolder));
  const packBytes = installed ? await sumDirectoryBytes(chgisPackDir(entityDbFolder)) : 0;

  return {
    installed,
    entityDbFolder,
    entityDbReady: true,
    layers: packManifest?.policy?.layers,
    placeCount: packManifest?.files?.['places.ndjson']?.entityCount,
    crosswalkCount: packManifest?.files?.['places.ndjson']?.crosswalkCount,
    installedAt: lifecycle.installedAt ?? packManifest?.compiledAt,
    sourceArchive: lifecycle.sourceArchive,
    diskBytes: rawBytes + packBytes,
    lastError: lifecycle.lastError,
    busy: chgisBusy,
  };
};

const runNodeScript = async (scriptPath: string, args: string[], cwd: string): Promise<void> => {
  const nodeModules = path.join(cwd, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error(
      `Run npm install in the authority extraction folder (${cwd}) before compiling CHGIS.`,
    );
  }
  await execFileAsync('node', [scriptPath, ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    timeout: COMPILE_TIMEOUT_MS,
    env: { ...process.env, NODE_PATH: nodeModules },
  });
};

const extractZipTo = async (zipPath: string, destDir: string): Promise<void> => {
  const archiveStat = await fsp.stat(zipPath);
  if (archiveStat.size > MAX_ARCHIVE_BYTES) throw new Error('CHGIS archive is too large.');
  const zip = await JSZip.loadAsync(await fsp.readFile(zipPath));
  const entries = Object.entries(zip.files);
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error('CHGIS archive has too many entries.');
  await fsp.mkdir(destDir, { recursive: true });
  const root = `${path.resolve(destDir)}${path.sep}`;
  let extractedBytes = 0;
  for (const [name, entry] of entries) {
    if (entry.dir) continue;
    const outPath = path.join(destDir, name);
    if (!path.resolve(outPath).startsWith(root)) {
      throw new Error(`CHGIS archive contains an unsafe path: ${name}`);
    }
    const data = await entry.async('nodebuffer');
    extractedBytes += data.byteLength;
    if (data.byteLength > MAX_ENTRY_BYTES || extractedBytes > MAX_ENTRY_BYTES) {
      throw new Error('CHGIS archive expands beyond the supported size limit.');
    }
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await fsp.writeFile(outPath, data);
  }
};

const stageInput = async (
  archivePath: string,
  entityDbFolder: string,
  onProgress?: (progress: ChgisInstallProgress) => void,
): Promise<string> => {
  const rawRoot = `${chgisRawRoot(entityDbFolder)}.new`;
  await fsp.rm(rawRoot, { recursive: true, force: true });
  await fsp.mkdir(rawRoot, { recursive: true });

  const stat = await fsp.stat(archivePath);
  if (stat.isDirectory()) {
    onProgress?.({ phase: 'extracting', message: 'Copying CHGIS files…' });
    const dest = path.join(rawRoot, path.basename(archivePath));
    await fsp.cp(archivePath, dest, { recursive: true });
    return dest;
  }

  if (archivePath.toLowerCase().endsWith('.zip')) {
    onProgress?.({ phase: 'extracting', message: 'Extracting CHGIS archive…' });
    const dest = path.join(rawRoot, path.basename(archivePath, '.zip'));
    await extractZipTo(archivePath, dest);
    return dest;
  }

  if (archivePath.toLowerCase().endsWith('.shp')) {
    const dest = path.join(rawRoot, 'layer');
    await fsp.mkdir(dest, { recursive: true });
    const base = path.basename(archivePath);
    const prefix = base.slice(0, -4);
    const dir = path.dirname(archivePath);
    for (const ext of ['.shp', '.shx', '.dbf', '.prj', '.cpg']) {
      const src = path.join(dir, `${prefix}${ext}`);
      if (fs.existsSync(src)) await fsp.copyFile(src, path.join(dest, `${prefix}${ext}`));
    }
    return dest;
  }

  throw new Error('Choose a .zip archive, folder, or .shp file from your CHGIS download.');
};

export interface InstallChgisOptions {
  entityDbFolder: string;
  archivePath: string;
  onProgress?: (progress: ChgisInstallProgress) => void;
}

export const installChgisFromArchive = async ({
  entityDbFolder,
  archivePath,
  onProgress,
}: InstallChgisOptions): Promise<ChgisInstallResult> => {
  if (chgisBusy) return { ok: false, error: 'CHGIS install already in progress.' };
  if (!entityDbFolderReady(entityDbFolder)) {
    return {
      ok: false,
      error: 'No authority-assets folder could be resolved; restart the app before installing CHGIS.',
    };
  }

  chgisBusy = true;
  const stagedRawRoot = `${chgisRawRoot(entityDbFolder)}.new`;
  try {
    const inputDir = await stageInput(archivePath, entityDbFolder, onProgress);
    const packOut = path.join(entityDbFolder, `${AUTHORITY_PACKS_DIRNAME}.chgis-new`);
    await fsp.rm(packOut, { recursive: true, force: true });

    const cbdbSqlite = path.join(entityDbFolder, AUTHORITY_DB_DIRNAME, 'cbdb.sqlite3');
    const extractionRoot = resolveAuthorityExtractionRoot();
    const args = ['--input', inputDir, '--out', path.join(packOut, 'chgis')];
    if (fs.existsSync(cbdbSqlite)) args.push('--cbdb-sqlite', cbdbSqlite);

    onProgress?.({ phase: 'compiling', message: 'Compiling CHGIS places…' });
    await runNodeScript(path.join(extractionRoot, 'chgis/compile.mjs'), args, extractionRoot);

    const liveRawRoot = chgisRawRoot(entityDbFolder);
    const bakRawRoot = `${liveRawRoot}.bak`;
    await fsp.rm(bakRawRoot, { recursive: true, force: true });
    if (fs.existsSync(liveRawRoot)) await fsp.rename(liveRawRoot, bakRawRoot);
    try {
      await fsp.rename(stagedRawRoot, liveRawRoot);
    } catch (error) {
      if (fs.existsSync(bakRawRoot) && !fs.existsSync(liveRawRoot)) {
        await fsp.rename(bakRawRoot, liveRawRoot);
      }
      throw error;
    }
    await fsp.rm(bakRawRoot, { recursive: true, force: true });

    const livePackDir = chgisPackDir(entityDbFolder);
    const bakPackDir = `${livePackDir}.bak`;
    await fsp.rm(bakPackDir, { recursive: true, force: true });
    if (fs.existsSync(livePackDir)) await fsp.rename(livePackDir, bakPackDir);
    try {
      await fsp.rename(path.join(packOut, 'chgis'), livePackDir);
    } catch (error) {
      if (fs.existsSync(bakPackDir) && !fs.existsSync(livePackDir)) {
        await fsp.rename(bakPackDir, livePackDir);
      }
      throw error;
    }
    await fsp.rm(packOut, { recursive: true, force: true });
    await fsp.rm(bakPackDir, { recursive: true, force: true });

    const packManifest = readPackManifest(entityDbFolder);
    const placeCount = packManifest?.files?.['places.ndjson']?.entityCount;

    const lifecycle = {
      version: 1,
      installedAt: new Date().toISOString(),
      sourceArchive: archivePath,
      lastError: undefined,
    };
    await fsp.mkdir(path.dirname(chgisManifestPath(entityDbFolder)), { recursive: true });
    await fsp.writeFile(
      chgisManifestPath(entityDbFolder),
      `${JSON.stringify(lifecycle, null, 2)}\n`,
      'utf-8',
    );

    return { ok: true, placeCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const lifecycle = {
        version: 1,
        lastError: message,
        installedAt: undefined,
      };
      await fsp.mkdir(path.dirname(chgisManifestPath(entityDbFolder)), { recursive: true });
      await fsp.writeFile(
        chgisManifestPath(entityDbFolder),
        `${JSON.stringify(lifecycle, null, 2)}\n`,
        'utf-8',
      );
    } catch {
      // ignore manifest write errors
    }
    return { ok: false, error: message };
  } finally {
    await fsp.rm(stagedRawRoot, { recursive: true, force: true }).catch(() => undefined);
    chgisBusy = false;
  }
};

export const removeChgisData = async (entityDbFolder: string): Promise<void> => {
  await fsp.rm(chgisRawRoot(entityDbFolder), { recursive: true, force: true });
  await fsp.rm(chgisPackDir(entityDbFolder), { recursive: true, force: true });
  await fsp.rm(chgisManifestPath(entityDbFolder), { force: true });
};

/** @internal test helper */
export const _setChgisBusyForTests = (value: boolean): void => {
  chgisBusy = value;
};
