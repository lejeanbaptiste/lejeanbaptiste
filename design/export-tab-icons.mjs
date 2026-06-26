#!/usr/bin/env node
/**
 * Regenerate tab icon PNGs from SVG sources.
 * Requires: rsvg-convert (brew install librsvg)
 *
 * Usage: node design/export-tab-icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 44;
const icons = ['tab_explorer', 'tab_find', 'tab_xpath', 'tab_toc', 'tab_tree', 'tab_entity'];
const targets = [
  __dirname,
  path.resolve(__dirname, '../apps/commons/src/icons/tab'),
];

for (const name of icons) {
  const svg = path.join(__dirname, `${name}.svg`);
  if (!existsSync(svg)) {
    console.error(`Missing ${svg}`);
    process.exit(1);
  }

  for (const dir of targets) {
    const png = path.join(dir, `${name}.png`);
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svg, '-o', png]);
    console.log(`Wrote ${png}`);
  }
}
