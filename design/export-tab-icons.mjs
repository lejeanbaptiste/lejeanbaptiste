#!/usr/bin/env node
/**
 * Regenerate tab icon PNGs from SVG sources (light + dark).
 * Requires: rsvg-convert (brew install librsvg)
 *
 * Light icons use LEAF primary teal (#163d40). Dark icons use LEAF dark-mode
 * primary (rgb(191, 213, 213) → #bfd5d5), not pure white.
 *
 * Usage: node design/export-tab-icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 44;
const icons = ['tab_explorer', 'tab_find', 'tab_xpath', 'tab_toc', 'tab_tree', 'tab_entity'];
const svgDirs = [__dirname, path.resolve(__dirname, '../apps/commons/src/icons/tab')];

/** Matches apps/commons theme dark primary: rgb(191, 213, 213) */
const DARK_PRIMARY = '#bfd5d5';

function toDarkSvg(lightSvg) {
  return lightSvg
    .replace(/#163d40/gi, DARK_PRIMARY)
    .replace(/fill:#ffffff/gi, 'fill:none')
    .replace(/fill-opacity:1/gi, (match, offset, whole) => {
      const before = whole.slice(Math.max(0, offset - 20), offset);
      return before.includes('fill:none') ? 'fill-opacity:0' : match;
    });
}

function exportPng(svgPath, pngPath) {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svgPath, '-o', pngPath]);
}

for (const name of icons) {
  const lightSvgPath = path.join(__dirname, `${name}.svg`);
  if (!existsSync(lightSvgPath)) {
    console.error(`Missing ${lightSvgPath}`);
    process.exit(1);
  }

  const lightSvg = readFileSync(lightSvgPath, 'utf8');
  const darkSvg = toDarkSvg(lightSvg);

  for (const dir of svgDirs) {
    const darkSvgPath = path.join(dir, `${name}.dark.svg`);
    writeFileSync(darkSvgPath, darkSvg);
    console.log(`Wrote ${darkSvgPath}`);

    exportPng(path.join(dir, `${name}.svg`), path.join(dir, `${name}.png`));
    console.log(`Wrote ${path.join(dir, `${name}.png`)}`);

    exportPng(darkSvgPath, path.join(dir, `${name}.dark.png`));
    console.log(`Wrote ${path.join(dir, `${name}.dark.png`)}`);
  }
}
