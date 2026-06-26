/**
 * Export design/icon.svg → design/icon.png (1024×1024) for Electron / macOS.
 * Requires rsvg-convert (librsvg), e.g. brew install librsvg.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'icon.svg');
const pngPath = path.join(__dirname, 'icon.png');

try {
  execFileSync(
    'rsvg-convert',
    ['-w', '1024', '-h', '1024', svgPath, '-o', pngPath],
    { stdio: 'inherit' },
  );
  console.log(`[design] Exported ${pngPath}`);
} catch {
  console.error('[design] rsvg-convert not found. Install with: brew install librsvg');
  process.exit(1);
}
