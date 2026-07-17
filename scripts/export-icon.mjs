/**
 * Export the branded app icon from the shared branding folder.
 *
 * The source icon lives in `apps/desktop/resources/branding`, and this script
 * regenerates the PNG icon plus Linux icon set from that source.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const brandingDir = path.join(repoRoot, 'apps/desktop/resources/branding');
const svgPath = path.join(brandingDir, 'icon.svg');
const pngPath = path.join(brandingDir, 'icon.png');
const iconsDir = path.join(brandingDir, 'icons');

const LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

const exportPng = (size, outPath) => {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svgPath, '-o', outPath], {
    stdio: 'inherit',
  });
};

try {
  exportPng(1024, pngPath);
  console.log(`[branding] Exported ${pngPath}`);

  mkdirSync(iconsDir, { recursive: true });
  for (const size of LINUX_SIZES) {
    exportPng(size, path.join(iconsDir, `${size}x${size}.png`));
  }
  console.log(`[branding] Exported Linux icon set to ${iconsDir}`);
} catch {
  if (existsSync(pngPath)) {
    console.log('[branding] rsvg-convert not found; keeping the existing icon.png.');
    process.exit(0);
  }

  console.error(
    '[branding] rsvg-convert not found and icon.png is missing. Install with: brew install librsvg (macOS) or apt install librsvg2-bin (Linux)',
  );
  process.exit(1);
}
