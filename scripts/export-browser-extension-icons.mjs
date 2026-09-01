/**
 * Export toolbar icons for the corpus-import browser extension.
 *
 * The main app icon SVG leaves ~11% margin around the maroon tile so dock /
 * desktop icons breathe; browser toolbars need the artwork edge-to-edge. This
 * script re-exports the shared branding SVG cropped to the tile bounds.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const svgPath = path.join(repoRoot, 'apps/desktop/resources/branding/icon.svg');
const outDir = path.join(repoRoot, 'apps/browser-extension/icons');

/** Matches the maroon rounded rect in icon.svg (user-space units). */
const ICON_CROP = {
  x: 191.19572,
  y: 174.42427,
  width: 1288.0554,
  height: 1318.2441,
};

const SIZES = [16, 32, 48, 128];

const buildCroppedSvg = (source) => {
  const { x, y, width, height } = ICON_CROP;
  return source
    .replace(/\s+width="[^"]*"/, '')
    .replace(/\s+height="[^"]*"/, '')
    .replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${width} ${height}"`)
    .replace('<svg', `<svg width="${width}" height="${height}"`);
};

const exportSize = (croppedSvg, size, outPath) => {
  const tmp = path.join(outDir, `.icon-export-${size}.svg`);
  writeFileSync(tmp, croppedSvg, 'utf8');
  try {
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), tmp, '-o', outPath], {
      stdio: 'inherit',
    });
  } finally {
    unlinkSync(tmp);
  }
};

const main = async () => {
  if (!existsSync(svgPath)) {
    console.error(`[browser-extension-icons] Missing source SVG: ${svgPath}`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const croppedSvg = buildCroppedSvg(await readFile(svgPath, 'utf8'));

  for (const size of SIZES) {
    const outPath = path.join(outDir, `icon-${size}.png`);
    exportSize(croppedSvg, size, outPath);
    console.log(`[browser-extension-icons] Exported ${outPath}`);
  }
};

try {
  await main();
} catch (error) {
  if (error?.code === 'ENOENT' && String(error).includes('rsvg-convert')) {
    console.error(
      '[browser-extension-icons] rsvg-convert not found. Install with: brew install librsvg (macOS) or apt install librsvg2-bin (Linux)',
    );
    process.exit(1);
  }
  throw error;
}
