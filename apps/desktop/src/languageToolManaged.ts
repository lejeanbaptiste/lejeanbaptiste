import { app } from 'electron';
import { mainT } from './mainI18n';
import { createHash } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { testLanguageToolConnection } from './languageToolClient';
import {
  canOfferManagedJreInstall,
  hasManagedJreInstalled,
  probeJava,
  type LanguageToolJavaStatus,
} from './languageToolJre';

export { downloadAndInstallManagedJre, parseJavaMajorVersion, probeJava } from './languageToolJre';
export type { LanguageToolJavaStatus };

/** Final numbered ZIP release (LT moved to snapshots after 6.6). */
export const LANGUAGE_TOOL_RELEASE = {
  version: '6.6',
  fileName: 'LanguageTool-6.6.zip',
  /** Approx size for progress UI (~220 MB). */
  bytes: 230_000_000,
  sha256: '53600506b399bb5ffe1e4c8dec794fd378212f14aaf38ccef9b6f89314d11631',
  downloadUrl: 'https://languagetool.org/download/LanguageTool-6.6.zip',
  /** Folder name inside the zip. */
  extractFolderName: 'LanguageTool-6.6',
} as const;

/** English n-gram pack (large — multi-GB). */
export const LANGUAGE_TOOL_EN_NGRAMS = {
  lang: 'en',
  fileName: 'ngrams-en-20150817.zip',
  bytes: 8_500_000_000,
  /** Official pack; sha256 not pinned here — verify size floor after extract. */
  downloadUrl: 'https://languagetool.org/download/ngram-data/ngrams-en-20150817.zip',
} as const;

export const LANGUAGE_TOOL_MANAGED_PORT = 8010;

const DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_LT_DOWNLOAD_BYTES = 512 * 1024 * 1024;
const MAX_NGRAM_DOWNLOAD_BYTES = 12 * 1024 * 1024 * 1024;

export interface LanguageToolInstallManifest {
  version: string;
  installedAt: string;
  distDir: string;
  port: number;
  ngrams?: { en?: boolean };
}

export interface LanguageToolInstallStatus {
  installed: boolean;
  version: string | null;
  path: string | null;
  port: number;
  ngrams: { en: boolean };
  java: LanguageToolJavaStatus;
  /** Grognard can download Temurin JRE on macOS / Windows when Java is missing or too old. */
  javaInstallOffered: boolean;
  managedJavaInstalled: boolean;
  server: 'stopped' | 'starting' | 'running' | 'failed';
  serverError?: string;
}

export type LanguageToolProgressCallback = (progress: {
  phase: 'download' | 'extract' | 'done';
  receivedBytes?: number;
  totalBytes?: number;
  message?: string;
}) => void;

let managedChild: ChildProcess | null = null;
let serverState: LanguageToolInstallStatus['server'] = 'stopped';
let serverError: string | undefined;

export const getLanguageToolRoot = (): string => path.join(app.getPath('userData'), 'languagetool');

export const getLanguageToolDistDir = (): string => path.join(getLanguageToolRoot(), 'dist');

export const getLanguageToolNgramsDir = (): string => path.join(getLanguageToolRoot(), 'ngrams');

export const getLanguageToolManifestPath = (): string =>
  path.join(getLanguageToolRoot(), 'install.json');

const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

const downloadToFile = async (
  url: string,
  destination: string,
  maxBytes: number,
  onProgress?: LanguageToolProgressCallback,
  totalHint?: number,
): Promise<void> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading LanguageTool.`);
  }
  const lengthHeader = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : totalHint;
  if (typeof totalBytes === 'number' && totalBytes > maxBytes) {
    throw new Error('Download exceeds the size limit.');
  }
  let received = 0;
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    async function* (chunks) {
      for await (const chunk of chunks) {
        received += (chunk as Buffer).length;
        if (received > maxBytes) throw new Error('Download exceeds the size limit.');
        onProgress?.({
          phase: 'download',
          receivedBytes: received,
          totalBytes,
        });
        yield chunk;
      }
    },
    fs.createWriteStream(destination),
  );
};

const readManifest = async (): Promise<LanguageToolInstallManifest | null> => {
  try {
    const raw = await fsp.readFile(getLanguageToolManifestPath(), 'utf-8');
    const parsed = JSON.parse(raw) as LanguageToolInstallManifest;
    if (!parsed?.version || !parsed?.distDir) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeManifest = async (manifest: LanguageToolInstallManifest): Promise<void> => {
  await fsp.mkdir(getLanguageToolRoot(), { recursive: true });
  await fsp.writeFile(getLanguageToolManifestPath(), JSON.stringify(manifest, null, 2), 'utf-8');
};

const findServerJar = async (distDir: string): Promise<string | null> => {
  const direct = path.join(distDir, 'languagetool-server.jar');
  if (fs.existsSync(direct)) return direct;
  try {
    const entries = await fsp.readdir(distDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nested = path.join(distDir, entry.name, 'languagetool-server.jar');
      if (fs.existsSync(nested)) return nested;
    }
  } catch {
    // ignore
  }
  return null;
};

const hasEnglishNgrams = async (): Promise<boolean> => {
  const enDir = path.join(getLanguageToolNgramsDir(), 'en');
  try {
    const entries = await fsp.readdir(enDir);
    return entries.some((name) => name.includes('gram'));
  } catch {
    return false;
  }
};

export const getLanguageToolInstallStatus = async (): Promise<LanguageToolInstallStatus> => {
  const java = await probeJava();
  const manifest = await readManifest();
  const jar = manifest ? await findServerJar(manifest.distDir) : null;
  const installed = Boolean(manifest && jar);
  const en = await hasEnglishNgrams();
  const managedJavaInstalled = await hasManagedJreInstalled();

  return {
    installed,
    version: installed ? manifest!.version : null,
    path: installed ? manifest!.distDir : null,
    port: LANGUAGE_TOOL_MANAGED_PORT,
    ngrams: { en },
    java,
    javaInstallOffered: !java.ok && canOfferManagedJreInstall(),
    managedJavaInstalled,
    server: serverState,
    serverError,
  };
};

const unzipTo = async (zipPath: string, destination: string): Promise<void> => {
  await fsp.mkdir(destination, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    execFile('unzip', ['-o', '-q', zipPath, '-d', destination], (error) => {
      if (error) {
        // Windows / systems without unzip: try PowerShell Expand-Archive
        if (process.platform === 'win32') {
          execFile(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
            ],
            (psError) => (psError ? reject(psError) : resolve()),
          );
          return;
        }
        reject(error);
        return;
      }
      resolve();
    });
  });
};

export const downloadAndInstallLanguageTool = async (
  onProgress?: LanguageToolProgressCallback,
): Promise<LanguageToolInstallStatus> => {
  const java = await probeJava();
  if (!java.ok) {
    throw new Error(java.error ?? 'Java 17+ is required to install LanguageTool.');
  }

  const root = getLanguageToolRoot();
  const tempRoot = path.join(root, '.download');
  const zipPath = path.join(tempRoot, LANGUAGE_TOOL_RELEASE.fileName);
  const extractRoot = path.join(tempRoot, 'extract');

  await fsp.rm(tempRoot, { recursive: true, force: true });
  await fsp.mkdir(extractRoot, { recursive: true });

  onProgress?.({
    phase: 'download',
    receivedBytes: 0,
    totalBytes: LANGUAGE_TOOL_RELEASE.bytes,
    message: mainT('downloading_language_tool'),
  });
  await downloadToFile(
    LANGUAGE_TOOL_RELEASE.downloadUrl,
    zipPath,
    MAX_LT_DOWNLOAD_BYTES,
    onProgress,
    LANGUAGE_TOOL_RELEASE.bytes,
  );

  const digest = await sha256File(zipPath);
  if (digest !== LANGUAGE_TOOL_RELEASE.sha256) {
    throw new Error('Downloaded LanguageTool failed checksum verification.');
  }

  onProgress?.({ phase: 'extract', message: mainT('extracting_language_tool') });
  await unzipTo(zipPath, extractRoot);

  const extracted = path.join(extractRoot, LANGUAGE_TOOL_RELEASE.extractFolderName);
  let jarPath = await findServerJar(extracted);
  if (!jarPath) jarPath = await findServerJar(extractRoot);
  if (!jarPath) {
    throw new Error('LanguageTool archive is missing languagetool-server.jar.');
  }
  const sourceDir = path.dirname(jarPath);

  const distDir = getLanguageToolDistDir();
  await fsp.rm(distDir, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(distDir), { recursive: true });
  await fsp.cp(sourceDir, distDir, { recursive: true });

  const finalJar = await findServerJar(distDir);
  if (!finalJar) throw new Error('Could not place languagetool-server.jar in the install folder.');

  const en = await hasEnglishNgrams();
  await writeManifest({
    version: LANGUAGE_TOOL_RELEASE.version,
    installedAt: new Date().toISOString(),
    distDir,
    port: LANGUAGE_TOOL_MANAGED_PORT,
    ngrams: { en },
  });

  await fsp.rm(tempRoot, { recursive: true, force: true });
  onProgress?.({ phase: 'done', message: mainT('language_tool_installed') });
  return getLanguageToolInstallStatus();
};

export const removeManagedLanguageTool = async (): Promise<LanguageToolInstallStatus> => {
  await stopManagedLanguageToolServer();
  await fsp.rm(getLanguageToolRoot(), { recursive: true, force: true });
  return getLanguageToolInstallStatus();
};

export const downloadEnglishNgrams = async (
  onProgress?: LanguageToolProgressCallback,
): Promise<LanguageToolInstallStatus> => {
  const ngramsRoot = getLanguageToolNgramsDir();
  const tempRoot = path.join(getLanguageToolRoot(), '.ngram-download');
  const zipPath = path.join(tempRoot, LANGUAGE_TOOL_EN_NGRAMS.fileName);

  await fsp.rm(tempRoot, { recursive: true, force: true });
  await fsp.mkdir(tempRoot, { recursive: true });
  await fsp.mkdir(ngramsRoot, { recursive: true });

  onProgress?.({
    phase: 'download',
    receivedBytes: 0,
    totalBytes: LANGUAGE_TOOL_EN_NGRAMS.bytes,
    message: mainT('downloading_english_ngrams'),
  });
  await downloadToFile(
    LANGUAGE_TOOL_EN_NGRAMS.downloadUrl,
    zipPath,
    MAX_NGRAM_DOWNLOAD_BYTES,
    onProgress,
    LANGUAGE_TOOL_EN_NGRAMS.bytes,
  );

  onProgress?.({ phase: 'extract', message: mainT('extracting_english_ngrams') });
  // Zip usually contains an `en/` folder; extract into ngrams root so we get ngrams/en/...
  await unzipTo(zipPath, ngramsRoot);

  const enOk = await hasEnglishNgrams();
  if (!enOk) {
    throw new Error('English n-gram extract did not produce the expected en/ folder.');
  }

  const manifest = await readManifest();
  if (manifest) {
    await writeManifest({ ...manifest, ngrams: { ...(manifest.ngrams ?? {}), en: true } });
  }

  await fsp.rm(tempRoot, { recursive: true, force: true });
  onProgress?.({ phase: 'done', message: mainT('english_ngrams_installed') });

  // Restart server so --languageModel can pick up the new data.
  if (serverState === 'running') {
    await stopManagedLanguageToolServer();
  }
  return getLanguageToolInstallStatus();
};

const waitForServer = async (port: number, timeoutMs = 90_000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await testLanguageToolConnection(`http://127.0.0.1:${port}`);
    if (result.ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

export const stopManagedLanguageToolServer = async (): Promise<void> => {
  if (!managedChild) {
    serverState = 'stopped';
    serverError = undefined;
    return;
  }
  const child = managedChild;
  managedChild = null;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
  serverState = 'stopped';
  serverError = undefined;
};

export const ensureManagedLanguageToolServer = async (options: {
  ngramsEnabled: boolean;
}): Promise<{ ok: boolean; error?: string; port: number }> => {
  const status = await getLanguageToolInstallStatus();
  if (!status.installed || !status.path) {
    return {
      ok: false,
      error: 'LanguageTool is not installed yet.',
      port: LANGUAGE_TOOL_MANAGED_PORT,
    };
  }
  if (!status.java.ok) {
    return { ok: false, error: status.java.error ?? 'Java 17+ is required.', port: status.port };
  }

  if (serverState === 'running' && managedChild && !managedChild.killed) {
    return { ok: true, port: status.port };
  }

  serverState = 'starting';
  serverError = undefined;

  const jar = await findServerJar(status.path);
  if (!jar) {
    serverState = 'failed';
    serverError = 'languagetool-server.jar is missing.';
    return { ok: false, error: serverError, port: status.port };
  }

  const javaBin = status.java.javaPath || 'java';
  const args = [
    '-cp',
    jar,
    'org.languagetool.server.HTTPServer',
    '--port',
    String(status.port),
    '--allow-origin',
    '*',
  ];

  if (options.ngramsEnabled && status.ngrams.en) {
    args.push('--languageModel', getLanguageToolNgramsDir());
  }

  try {
    managedChild = spawn(javaBin, args, {
      cwd: path.dirname(jar),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
  } catch (error) {
    serverState = 'failed';
    serverError = error instanceof Error ? error.message : 'Failed to start LanguageTool.';
    return { ok: false, error: serverError, port: status.port };
  }

  let stderr = '';
  managedChild.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
    if (stderr.length > 8000) stderr = stderr.slice(-4000);
  });
  managedChild.on('exit', (code) => {
    if (managedChild) {
      managedChild = null;
      serverState = 'failed';
      serverError = `LanguageTool exited (code ${code ?? '?'}). ${stderr.trim()}`.trim();
    }
  });

  const ready = await waitForServer(status.port);
  if (!ready) {
    await stopManagedLanguageToolServer();
    serverState = 'failed';
    serverError = stderr.trim() || 'LanguageTool did not become ready in time.';
    return { ok: false, error: serverError, port: status.port };
  }

  serverState = 'running';
  serverError = undefined;
  return { ok: true, port: status.port };
};
