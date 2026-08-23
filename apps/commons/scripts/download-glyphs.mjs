#!/usr/bin/env node
/**
 * Downloads pre-rendered SDF glyph PBFs for the place-comparison map's
 * labeled basemap (see PlaceComparisonMap.tsx's vectorStyle, Phase 6 follow-up
 * — city/province/place-name labels, not just unlabeled geometry). Mirrors
 * apps/desktop/scripts/download-pmtiles.mjs's "skip if already present" shape.
 *
 * Unlike the per-region .pmtiles bundles (downloaded on demand from Settings,
 * since a single one can run into the hundreds of MB), glyphs are the same
 * regardless of which region a user has installed and are small (~6MB per
 * font stack) — so they're fetched once here at dev/build time and bundled
 * into the app like any other static asset, no separate download flow needed.
 *
 * Font stacks match exactly what @protomaps/basemaps' label layers
 * reference (see `text-font` in `layers('protomaps', namedFlavor('light'), ...)`
 * output)
 * — Protomaps' pre-built "Noto Sans" stacks bundle broad multi-script
 * coverage (Latin, CJK, etc.) into a single font so one glyph set works for
 * every region this app supports without per-language font wiring.
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '../../desktop/scripts/retryable-fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../resources/fonts');
const SOURCE_REPO = 'protomaps/basemaps-assets';
const SOURCE_BRANCH = 'main';
const FONT_STACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const EXPECTED_RANGE_COUNT = 256;
const CONCURRENCY = 12;

const listRangeFiles = async (fontStack) => {
  const apiUrl = `https://api.github.com/repos/${SOURCE_REPO}/contents/fonts/${encodeURIComponent(fontStack)}?ref=${SOURCE_BRANCH}`;
  const response = await fetchWithRetry(apiUrl, { headers: { Accept: 'application/vnd.github+json' } }, { label: `${fontStack} listing` });
  const entries = await response.json();
  return entries.filter((e) => e.type === 'file' && e.name.endsWith('.pbf')).map((e) => e.name);
};

const downloadFile = async (fontStack, fileName, destPath) => {
  const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/fonts/${encodeURIComponent(fontStack)}/${fileName}`;
  const response = await fetchWithRetry(url, undefined, { label: `${fontStack}/${fileName}` });
  await pipeline(response.body, createWriteStream(`${destPath}.tmp`));
  await rename(`${destPath}.tmp`, destPath);
};

const runWithConcurrency = async (items, limit, worker) => {
  let cursor = 0;
  const errors = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      try {
        await worker(item);
      } catch (error) {
        errors.push(error);
      }
    }
  });
  await Promise.all(workers);
  if (errors.length > 0) throw errors[0];
};

let downloaded = 0;
let skipped = 0;

for (const fontStack of FONT_STACKS) {
  const stackDir = path.join(FONTS_DIR, fontStack);
  mkdirSync(stackDir, { recursive: true });

  const alreadyPresent = existsSync(stackDir)
    ? readdirSync(stackDir).filter((f) => f.endsWith('.pbf')).length
    : 0;
  if (alreadyPresent >= EXPECTED_RANGE_COUNT) {
    console.log(`[glyphs] ${fontStack}: already present (${alreadyPresent} ranges), skipping.`);
    skipped += alreadyPresent;
    continue;
  }

  console.log(`[glyphs] ${fontStack}: fetching range list...`);
  const rangeFiles = await listRangeFiles(fontStack);

  const missing = rangeFiles.filter((name) => !existsSync(path.join(stackDir, name)));
  if (missing.length === 0) {
    console.log(`[glyphs] ${fontStack}: all ${rangeFiles.length} ranges already present.`);
    skipped += rangeFiles.length;
    continue;
  }

  console.log(`[glyphs] ${fontStack}: downloading ${missing.length}/${rangeFiles.length} range(s)...`);
  await runWithConcurrency(missing, CONCURRENCY, (fileName) =>
    downloadFile(fontStack, fileName, path.join(stackDir, fileName)),
  );
  downloaded += missing.length;
}

console.log(`[glyphs] Done — downloaded ${downloaded}, already had ${skipped}.`);
