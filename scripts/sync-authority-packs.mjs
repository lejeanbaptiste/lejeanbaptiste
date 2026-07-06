#!/usr/bin/env node
/**
 * Copy compiled NDJSON packs from authority extraction into the entity DB folder.
 *
 * Usage:
 *   node scripts/sync-authority-packs.mjs [entityDbFolder]
 *
 * Default entity DB folder: read from leaf-writer test_project if present,
 * else ../authority extraction/packs as dry-run message only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultSource = path.resolve(repoRoot, '../authority extraction/packs');

const packFiles = [
  'cbdb/persons.ndjson',
  'cbdb/places.ndjson',
  'cbdb/offices.ndjson',
  'cbdb/manifest.json',
  'dila/persons.ndjson',
  'dila/places.ndjson',
  'dila/manifest.json',
];

const destRoot = process.argv[2]
  ? path.resolve(process.argv[2], 'authority-packs')
  : null;

if (!fs.existsSync(defaultSource)) {
  console.error(`Source packs not found: ${defaultSource}`);
  console.error('Run: cd "../authority extraction" && npm run compile:cbdb && npm run compile:dila');
  process.exit(1);
}

if (!destRoot) {
  console.log('Usage: node scripts/sync-authority-packs.mjs <entityDbFolder>');
  console.log(`Source: ${defaultSource}`);
  process.exit(0);
}

fs.mkdirSync(destRoot, { recursive: true });
for (const rel of packFiles) {
  const src = path.join(defaultSource, rel);
  const dest = path.join(destRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  ${rel}`);
}
console.log(`\nInstalled to ${destRoot}`);
