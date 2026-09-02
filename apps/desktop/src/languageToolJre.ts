import { app } from 'electron';
import { mainT } from './mainI18n';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface LanguageToolJavaStatus {
  ok: boolean;
  version?: string;
  major?: number;
  error?: string;
  javaPath?: string;
  /** True when the runtime lives under LJB-managed userData (ljb-java). */
  managed?: boolean;
}

/** Parse `java -version` stderr (e.g. openjdk version "17.0.9"). Exported for tests. */
export const parseJavaMajorVersion = (versionOutput: string): number | null => {
  const match = versionOutput.match(/version\s+"?(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = match[2] !== undefined ? Number(match[2]) : undefined;
  if (!Number.isFinite(major)) return null;
  // Legacy: "1.8.0_381" → 8
  if (major === 1 && typeof minor === 'number' && Number.isFinite(minor)) return minor;
  return major;
};

/** Pinned Temurin 17 JRE — same release family on macOS and Windows. */
export const TEMURIN_JRE_VERSION = '17.0.14+7';

export interface TemurinJreRelease {
  version: string;
  fileName: string;
  downloadUrl: string;
  sha256: string;
  /** Approx size for progress UI. */
  bytes: number;
  archive: 'tar.gz' | 'zip';
}

const TEMURIN_JRE_RELEASES: Record<string, TemurinJreRelease> = {
  'darwin-arm64': {
    version: TEMURIN_JRE_VERSION,
    fileName: 'OpenJDK17U-jre_aarch64_mac_hotspot_17.0.14_7.tar.gz',
    downloadUrl:
      'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_aarch64_mac_hotspot_17.0.14_7.tar.gz',
    sha256: '9fb89125d5807f42cec588824fde487be42273a89c55ccfc5f44efda64e03e2c',
    bytes: 42_560_960,
    archive: 'tar.gz',
  },
  'darwin-x64': {
    version: TEMURIN_JRE_VERSION,
    fileName: 'OpenJDK17U-jre_x64_mac_hotspot_17.0.14_7.tar.gz',
    downloadUrl:
      'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_x64_mac_hotspot_17.0.14_7.tar.gz',
    sha256: 'f2c7454f7aba076cd414887b31da92e4a50fda7a13d97f6e295c911af60de0b6',
    bytes: 37_479_311,
    archive: 'tar.gz',
  },
  'win32-x64': {
    version: TEMURIN_JRE_VERSION,
    fileName: 'OpenJDK17U-jre_x64_windows_hotspot_17.0.14_7.zip',
    downloadUrl:
      'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_x64_windows_hotspot_17.0.14_7.zip',
    sha256: 'd42f84605c8e27c38998b44ac493d1067abbe45be89969c935d71a858393405c',
    bytes: 43_664_809,
    archive: 'zip',
  },
};

const DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_JRE_DOWNLOAD_BYTES = 128 * 1024 * 1024;

export interface ManagedJreManifest {
  version: string;
  javaPath: string;
  installedAt: string;
}

export type LanguageToolJreProgressCallback = (progress: {
  phase: 'download' | 'extract' | 'done';
  receivedBytes?: number;
  totalBytes?: number;
  message?: string;
}) => void;

export const getManagedJreRoot = (): string => path.join(app.getPath('userData'), 'ljb-java');

export const getManagedJreRuntimeDir = (): string => path.join(getManagedJreRoot(), 'runtime');

export const getManagedJreManifestPath = (): string =>
  path.join(getManagedJreRoot(), 'install.json');

export const getJreReleaseForPlatform = (
  platform: NodeJS.Platform,
  arch: string,
): TemurinJreRelease | null => {
  const key = `${platform}-${arch}`;
  if (TEMURIN_JRE_RELEASES[key]) return TEMURIN_JRE_RELEASES[key];
  // Windows on ARM64: Temurin has no arm64 JRE; x64 build usually runs under emulation.
  if (platform === 'win32' && arch === 'arm64') return TEMURIN_JRE_RELEASES['win32-x64'];
  return null;
};

export const canOfferManagedJreInstall = (): boolean =>
  getJreReleaseForPlatform(process.platform, process.arch) !== null;

/** Locate `bin/java` (or macOS `Contents/Home/bin/java`) under an extracted JRE tree. */
export const resolveJavaBinaryInTree = (root: string): string | null => {
  const javaName = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [
    path.join(root, 'Contents', 'Home', 'bin', javaName),
    path.join(root, 'bin', javaName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return findJavaBinaryRecursive(root, javaName, 0);
};

const findJavaBinaryRecursive = (dir: string, javaName: string, depth: number): string | null => {
  if (depth > 5) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(dir, entry.name);
    const direct = path.join(child, 'bin', javaName);
    if (fs.existsSync(direct)) return direct;
    const macJava = path.join(child, 'Contents', 'Home', 'bin', javaName);
    if (fs.existsSync(macJava)) return macJava;
    const nested = findJavaBinaryRecursive(child, javaName, depth + 1);
    if (nested) return nested;
  }
  return null;
};

const readManagedJreManifest = async (): Promise<ManagedJreManifest | null> => {
  try {
    const raw = await fsp.readFile(getManagedJreManifestPath(), 'utf-8');
    const parsed = JSON.parse(raw) as ManagedJreManifest;
    if (!parsed?.javaPath || !parsed.version) return null;
    if (!fs.existsSync(parsed.javaPath)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeManagedJreManifest = async (manifest: ManagedJreManifest): Promise<void> => {
  await fsp.mkdir(getManagedJreRoot(), { recursive: true });
  await fsp.writeFile(getManagedJreManifestPath(), JSON.stringify(manifest, null, 2), 'utf-8');
};

export const hasManagedJreInstalled = async (): Promise<boolean> => {
  const manifest = await readManagedJreManifest();
  return manifest !== null;
};

export const collectJavaCandidatePaths = async (): Promise<string[]> => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (candidate: string | null | undefined) => {
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate);
  };

  const manifest = await readManagedJreManifest();
  add(manifest?.javaPath);

  const runtimeDir = getManagedJreRuntimeDir();
  if (fs.existsSync(runtimeDir)) {
    add(resolveJavaBinaryInTree(runtimeDir));
  }

  if (process.env.JAVA_HOME) {
    add(
      path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
    );
  }

  add(process.platform === 'win32' ? 'java.exe' : 'java');
  return candidates;
};

export const probeJavaAtPath = (javaPath: string): Promise<LanguageToolJavaStatus> =>
  new Promise((resolve) => {
    execFile(javaPath, ['-version'], { timeout: 15_000 }, (error, _stdout, stderr) => {
      const output = `${stderr ?? ''}\n${error instanceof Error ? error.message : ''}`;
      if (error && !stderr) {
        resolve({
          ok: false,
          error: 'Java was not found at this path.',
          javaPath,
        });
        return;
      }
      const major = parseJavaMajorVersion(stderr || output);
      if (major === null) {
        resolve({
          ok: false,
          error: 'Could not parse the Java version.',
          javaPath,
          version: (stderr || '').trim().split('\n')[0],
        });
        return;
      }
      if (major < 17) {
        resolve({
          ok: false,
          major,
          version: `Java ${major}`,
          error: `LanguageTool needs Java 17 or newer (found ${major}).`,
          javaPath,
        });
        return;
      }
      resolve({
        ok: true,
        major,
        version: `Java ${major}`,
        javaPath,
        managed: isManagedJavaPath(javaPath),
      });
    });
  });

export const isManagedJavaPath = (javaPath: string): boolean => {
  const managedRoot = path.resolve(getManagedJreRoot());
  const resolved = path.resolve(javaPath);
  return resolved === managedRoot || resolved.startsWith(`${managedRoot}${path.sep}`);
};

export const probeJava = async (): Promise<LanguageToolJavaStatus> => {
  const candidates = await collectJavaCandidatePaths();
  let lastFailure: LanguageToolJavaStatus | null = null;

  for (const javaPath of candidates) {
    const result = await probeJavaAtPath(javaPath);
    if (result.ok) return result;
    lastFailure = result;
  }

  const canOffer = canOfferManagedJreInstall();
  return (
    lastFailure ?? {
      ok: false,
      error: canOffer
        ? 'Java 17+ is required. Download it below or install Temurin / Homebrew openjdk@17.'
        : 'Java 17+ is required. Install Temurin or Homebrew openjdk@17, then refresh.',
      javaPath: process.platform === 'win32' ? 'java.exe' : 'java',
    }
  );
};

const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

const downloadToFile = async (
  url: string,
  destination: string,
  maxBytes: number,
  onProgress?: LanguageToolJreProgressCallback,
  totalHint?: number,
): Promise<void> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} downloading Java.`);
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

const extractArchive = async (
  archivePath: string,
  destination: string,
  archive: TemurinJreRelease['archive'],
): Promise<void> => {
  await fsp.mkdir(destination, { recursive: true });
  if (archive === 'tar.gz') {
    await new Promise<void>((resolve, reject) => {
      execFile('tar', ['-xzf', archivePath, '-C', destination], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
      ],
      (error) => (error ? reject(error) : resolve()),
    );
  });
};

const clearMacQuarantine = async (target: string): Promise<void> => {
  if (process.platform !== 'darwin') return;
  await new Promise<void>((resolve) => {
    execFile('xattr', ['-dr', 'com.apple.quarantine', target], () => resolve());
  });
};

export const downloadAndInstallManagedJre = async (
  onProgress?: LanguageToolJreProgressCallback,
): Promise<LanguageToolJavaStatus> => {
  const release = getJreReleaseForPlatform(process.platform, process.arch);
  if (!release) {
    throw new Error('Managed Java install is not available on this platform.');
  }

  const existing = await probeJava();
  if (existing.ok && existing.managed) return existing;

  const root = getManagedJreRoot();
  const tempRoot = path.join(root, '.download');
  const archivePath = path.join(tempRoot, release.fileName);
  const extractRoot = path.join(tempRoot, 'extract');
  const runtimeDir = getManagedJreRuntimeDir();

  await fsp.rm(tempRoot, { recursive: true, force: true });
  await fsp.mkdir(extractRoot, { recursive: true });

  onProgress?.({
    phase: 'download',
    receivedBytes: 0,
    totalBytes: release.bytes,
    message: mainT('downloading_java'),
  });
  await downloadToFile(
    release.downloadUrl,
    archivePath,
    MAX_JRE_DOWNLOAD_BYTES,
    onProgress,
    release.bytes,
  );

  const digest = await sha256File(archivePath);
  if (digest !== release.sha256) {
    throw new Error('Downloaded Java failed checksum verification.');
  }

  onProgress?.({ phase: 'extract', message: mainT('extracting_java') });
  await extractArchive(archivePath, extractRoot, release.archive);

  const entries = await fsp.readdir(extractRoot, { withFileTypes: true });
  const topDir = entries.find((entry) => entry.isDirectory());
  const extractedTree = topDir ? path.join(extractRoot, topDir.name) : extractRoot;
  const javaPath = resolveJavaBinaryInTree(extractedTree);
  if (!javaPath) {
    throw new Error('Extracted Java runtime is missing bin/java.');
  }

  await fsp.rm(runtimeDir, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(runtimeDir), { recursive: true });
  await fsp.cp(extractedTree, runtimeDir, { recursive: true });

  const finalJavaPath = resolveJavaBinaryInTree(runtimeDir);
  if (!finalJavaPath) {
    throw new Error('Could not place the Java runtime in the install folder.');
  }

  await clearMacQuarantine(runtimeDir);

  await writeManagedJreManifest({
    version: release.version,
    javaPath: finalJavaPath,
    installedAt: new Date().toISOString(),
  });

  await fsp.rm(tempRoot, { recursive: true, force: true });
  onProgress?.({ phase: 'done', message: mainT('java_installed') });

  const probed = await probeJavaAtPath(finalJavaPath);
  if (!probed.ok) {
    throw new Error(probed.error ?? 'Installed Java did not pass version check.');
  }
  return { ...probed, managed: true };
};
