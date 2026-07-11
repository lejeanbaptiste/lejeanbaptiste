#!/usr/bin/env node
/**
 * Stages a self-contained sanmiao runtime into apps/desktop/resources/sanmiao-runtime.
 *
 * This script does not download Python. It copies a prepared runtime from either:
 * - SANMIAO_RUNTIME_DIR
 * - a sibling ../sanmiao-runtime folder
 *
 * Expected source layout for Windows:
 * - python.exe
 * - python3.dll
 * - python311.zip or equivalent standard-library zip
 * - Lib/site-packages/sanmiao/
 * - Lib/site-packages/<sanmiao deps>
 *
 * The staged folder is what electron-builder ships for Windows.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = path.join(__dirname, '../resources/sanmiao-runtime');

const candidates = [
  process.env.SANMIAO_RUNTIME_DIR?.trim(),
  'C:/work/sanmiao-runtime',
  path.resolve(__dirname, '../../../sanmiao-runtime'),
  path.resolve(process.cwd(), '../sanmiao-runtime'),
].filter(Boolean);

const sourceRoot = candidates.find((candidate) => candidate && existsSync(candidate));

if (!sourceRoot) {
  console.log(
    '[sanmiao-runtime] No prepared runtime found. Set SANMIAO_RUNTIME_DIR or create a sibling sanmiao-runtime folder.',
  );
  process.exit(0);
}

const requiredFiles = [
  path.join(sourceRoot, 'python.exe'),
  path.join(sourceRoot, 'Lib'),
];

const missing = requiredFiles.filter((entry) => !existsSync(entry));
if (missing.length > 0) {
  console.error(
    `[sanmiao-runtime] Prepared runtime is missing expected files: ${missing.join(', ')}`,
  );
  process.exit(1);
}

const copyRecursive = (source, target) => {
  const stats = statSync(source);
  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
};

rmSync(targetRoot, { recursive: true, force: true });
copyRecursive(sourceRoot, targetRoot);

console.log(`[sanmiao-runtime] Staged ${sourceRoot} -> ${targetRoot}`);
