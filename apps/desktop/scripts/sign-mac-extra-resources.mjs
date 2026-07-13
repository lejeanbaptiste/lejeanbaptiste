/**
 * electron-builder afterPack hook (macOS only).
 *
 * Code-signs Mach-O binaries bundled via extraResources (the CPython runtime
 * and the LemMinX binary) with the hardened runtime, so notarization accepts
 * them. electron-builder only signs the app executable, frameworks and
 * helpers — binaries under Contents/Resources must be signed explicitly.
 *
 * Runs before electron-builder signs/seals the app bundle, so the seal
 * covers the signed binaries. Skips silently when no Developer ID
 * Application identity is available (unsigned CI builds).
 */
import { execFileSync } from 'node:child_process';
import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import path from 'node:path';

const SIGN_DIRS = ['python', 'lemminx'];

const MACHO_MAGIC = new Set([
  0xfeedface, // 32-bit
  0xfeedfacf, // 64-bit
  0xcefaedfe, // 32-bit, byte-swapped
  0xcffaedfe, // 64-bit, byte-swapped
  0xcafebabe, // universal
  0xbebafeca, // universal, byte-swapped
]);

const isMachO = (file) => {
  // 0xcafebabe is also the Java .class magic; none are bundled, but be safe.
  if (file.endsWith('.class')) return false;
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(4);
    if (readSync(fd, buf, 0, 4, 0) < 4) return false;
    return MACHO_MAGIC.has(buf.readUInt32BE(0));
  } finally {
    closeSync(fd);
  }
};

const collectMachO = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      collectMachO(full, out);
    } else if (entry.isFile() && statSync(full).size >= 4 && isMachO(full)) {
      out.push(full);
    }
  }
  return out;
};

const findIdentity = () => {
  if (process.env.CSC_NAME) return process.env.CSC_NAME;
  try {
    const output = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
    });
    const match = output.match(/"(Developer ID Application: [^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export default async function signMacExtraResources(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const identity = findIdentity();
  if (!identity) {
    console.log('  • no Developer ID Application identity found, skipping extraResources signing');
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const resourcesDir = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  const entitlements = path.join(context.packager.projectDir, 'resources', 'entitlements.mac.plist');

  const binaries = [];
  for (const dir of SIGN_DIRS) {
    const full = path.join(resourcesDir, dir);
    try {
      statSync(full);
    } catch {
      continue;
    }
    collectMachO(full, binaries);
  }
  if (binaries.length === 0) return;

  console.log(`  • signing ${binaries.length} extraResources binaries  identity=${identity}`);
  const CHUNK = 50;
  for (let i = 0; i < binaries.length; i += CHUNK) {
    execFileSync(
      'codesign',
      [
        '--force',
        '--sign',
        identity,
        '--options',
        'runtime',
        '--timestamp',
        '--entitlements',
        entitlements,
        ...binaries.slice(i, i + CHUNK),
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
  }
}
