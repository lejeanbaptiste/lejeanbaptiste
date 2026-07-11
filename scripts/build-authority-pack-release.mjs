#!/usr/bin/env node
/**
 * Build release-ready authority-pack assets from a pack tree.
 *
 * Output:
 *   - packs-index.json
 *   - authority-packs-chinese.tar.gz
 *   - authority-packs-japanese.tar.gz
 *   - authority-packs-tibetan.tar.gz
 *   - SHA256SUMS
 *
 * Usage:
 *   node scripts/build-authority-pack-release.mjs [sourceDir] [outputDir]
 *
 * Defaults:
 *   sourceDir = test_project/authority-packs
 *   outputDir = release
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultSourceDir = path.join(repoRoot, 'test_project', 'authority-packs');
const defaultOutputDir = path.join(repoRoot, 'release');

const sourceDir = path.resolve(process.argv[2] ?? defaultSourceDir);
const outputDir = path.resolve(process.argv[3] ?? defaultOutputDir);
const archiveRootName = path.basename(sourceDir);
const archiveParentDir = path.dirname(sourceDir);

const bundleVersion = process.env.AUTHORITY_PACKS_BUNDLE_VERSION ?? new Date().toISOString().slice(0, 10);
const compilePolicyVersion = process.env.AUTHORITY_PACKS_COMPILE_POLICY_VERSION ?? bundleVersion;

const bundleSpecs = [
  {
    id: 'chinese',
    fileName: 'authority-packs-chinese.tar.gz',
    include: ['cbdb', 'dila', 'chgis', 'wikidata'],
    exclude: [
      'wikidata/person-bo',
      'wikidata/place-bo',
      'wikidata/org-bo',
      'wikidata/person-ja-japan',
      'wikidata/org-ja',
      'wikidata/work-ja',
    ],
  },
  {
    id: 'japanese',
    fileName: 'authority-packs-japanese.tar.gz',
    include: ['ndl', 'wikidata'],
    exclude: [
      'wikidata/person-bo',
      'wikidata/place-bo',
      'wikidata/org-bo',
      'wikidata/person-zh-hant-pre-ming',
      'wikidata/person-zh-hant-ming',
      'wikidata/person-zh-hant-qing',
      'wikidata/org-zh-hant',
      'wikidata/work-zh-hant',
    ],
  },
  {
    id: 'tibetan',
    fileName: 'authority-packs-tibetan.tar.gz',
    include: ['wikidata'],
    exclude: [
      'wikidata/person-ja-japan',
      'wikidata/org-ja',
      'wikidata/work-ja',
      'wikidata/person-zh-hant-pre-ming',
      'wikidata/person-zh-hant-ming',
      'wikidata/person-zh-hant-qing',
      'wikidata/org-zh-hant',
      'wikidata/work-zh-hant',
      'wikidata/person-bo',
      'wikidata/place-bo',
      'wikidata/org-bo',
    ],
  },
];

const sha256File = async (filePath) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

const relFromSource = (fullPath) => path.relative(sourceDir, fullPath).split(path.sep).join('/');

const listFiles = async (baseDir) => {
  const out = [];
  const walk = async (dir) => {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  };
  await walk(baseDir);
  return out;
};

const shouldInclude = (relPath, spec) => {
  const top = relPath.split('/')[0];
  if (!spec.include.includes(top)) return false;
  return !spec.exclude.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
};

const bundleFiles = async (spec) => {
  const allFiles = await listFiles(sourceDir);
  return allFiles.map(relFromSource).filter((rel) => shouldInclude(rel, spec));
};

await fsp.mkdir(outputDir, { recursive: true });

const bundles = [];
const shaLines = [];

for (const spec of bundleSpecs) {
  const files = await bundleFiles(spec);
  const filesMeta = [];
  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    filesMeta.push({
      path: file,
      bytes: (await fsp.stat(filePath)).size,
      sha256: await sha256File(filePath),
    });
  }
  const tempList = path.join(outputDir, `${spec.id}.files.txt`);
  const tarballPath = path.join(outputDir, spec.fileName);
  await fsp.writeFile(
    tempList,
    `${files.map((file) => `${archiveRootName}/${file}`).join('\n')}\n`,
    'utf-8',
  );
  await execFileAsync('tar', ['-czf', tarballPath, '-C', archiveParentDir, '-T', tempList]);
  await fsp.rm(tempList, { force: true });

  const bytes = (await fsp.stat(tarballPath)).size;
  const sha256 = await sha256File(tarballPath);

  bundles.push({
    id: spec.id,
    fileName: spec.fileName,
    bytes,
    sha256,
    pathPrefix: 'authority-packs',
    fileCount: files.length,
    files: filesMeta,
  });
  shaLines.push(`${sha256}  ${spec.fileName}`);
}

const index = {
  schemaVersion: 1,
  bundleVersion,
  compilePolicyVersion,
  builtAt: new Date().toISOString(),
  defaultBundleId: 'chinese',
  bundles,
};

const indexPath = path.join(outputDir, 'packs-index.json');
await fsp.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
shaLines.push(`${await sha256File(indexPath)}  packs-index.json`);
await fsp.writeFile(path.join(outputDir, 'SHA256SUMS'), `${shaLines.join('\n')}\n`, 'utf-8');

console.log(`Wrote release assets to ${outputDir}`);
for (const bundle of bundles) {
  console.log(`- ${bundle.fileName}`);
}
console.log('- packs-index.json');
console.log('- SHA256SUMS');
