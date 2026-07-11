/**
 * Export design/icon.svg → design/icon.png (1024×1024) for Electron / macOS,
 * plus design/icons/{size}x{size}.png set for Linux.
 * Requires rsvg-convert (librsvg): brew install librsvg / apt install librsvg2-bin.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'icon.svg');
const pngPath = path.join(__dirname, 'icon.png');
const iconsDir = path.join(__dirname, 'icons');

const LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

const exportPng = (size, outPath) => {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svgPath, '-o', outPath], {
    stdio: 'inherit',
  });
};

try {
  exportPng(1024, pngPath);
  console.log(`[design] Exported ${pngPath}`);

  mkdirSync(iconsDir, { recursive: true });
  for (const size of LINUX_SIZES) {
    exportPng(size, path.join(iconsDir, `${size}x${size}.png`));
  }
  console.log(`[design] Exported Linux icon set to ${iconsDir}`);
} catch {
  if (existsSync(pngPath)) {
    console.log(
      '[design] rsvg-convert not found; keeping the existing icon.png (pre-generated asset).',
    );
    process.exit(0);
  }

  console.error(
    '[design] rsvg-convert not found and icon.png is missing. Install with: brew install librsvg (macOS) or apt install librsvg2-bin (Linux)',
  );
  process.exit(1);
}
