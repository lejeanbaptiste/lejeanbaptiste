/**
 * macOS dev branding: maintain a local "Le Jean-Baptiste.app" bundle for dev.
 * Dock and Cmd+Tab read the .app bundle name/identity — patching node_modules
 * alone is not enough when the bundle folder is still named Electron.app.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_NAME = 'Le Jean-Baptiste';
const DEV_APP_NAME = 'Le Jean-Baptiste.app';
const DEV_BUNDLE_ID = 'fr.huma-num.le-jean-baptiste.dev';

if (process.platform !== 'darwin') {
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const devDir = path.join(desktopRoot, '.dev');
const devAppRoot = path.join(devDir, DEV_APP_NAME);
const devPlistPath = path.join(devAppRoot, 'Contents/Info.plist');
const devBundleIconPath = path.join(devAppRoot, 'Contents/Resources/electron.icns');
const versionMarkerPath = path.join(devDir, 'electron-version.txt');

const repoRoot = path.resolve(desktopRoot, '../..');
const designDir = path.join(repoRoot, 'design');
const pngPath = path.join(designDir, 'icon.png');
const exportScript = path.join(designDir, 'export-icon.mjs');

const require = createRequire(import.meta.url);
const electronRoot = path.dirname(require.resolve('electron/package.json'));
const sourceAppRoot = path.join(electronRoot, 'dist/Electron.app');
const electronVersion = readFileSync(path.join(electronRoot, 'dist/version'), 'utf8').trim();

const readPlistValue = (plistPath, key) =>
  execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plistPath], {
    encoding: 'utf8',
  }).trim();

const writePlistValue = (plistPath, key, value) => {
  execFileSync('plutil', ['-replace', key, '-string', value, plistPath]);
};

const ensurePngIcon = () => {
  if (!existsSync(pngPath) && existsSync(exportScript)) {
    execFileSync('node', [exportScript], { stdio: 'inherit' });
  }
  if (!existsSync(pngPath)) {
    throw new Error(`Missing icon PNG at ${pngPath}`);
  }
};

const buildIcnsFromPng = (sourcePng, targetIcns) => {
  const iconsetDir = path.join(os.tmpdir(), `ljb-icon-${process.pid}.iconset`);
  mkdirSync(iconsetDir, { recursive: true });
  const entries = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ];

  try {
    for (const [size, filename] of entries) {
      const out = path.join(iconsetDir, filename);
      execFileSync('sips', ['-z', String(size), String(size), sourcePng, '--out', out], {
        stdio: 'ignore',
      });
    }

    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', targetIcns], {
      stdio: 'ignore',
    });
  } finally {
    rmSync(iconsetDir, { recursive: true, force: true });
  }
};

const syncDevAppBundle = () => {
  mkdirSync(devDir, { recursive: true });

  const previousVersion = existsSync(versionMarkerPath)
    ? readFileSync(versionMarkerPath, 'utf8').trim()
    : '';

  if (!existsSync(devAppRoot) || previousVersion !== electronVersion) {
    rmSync(devAppRoot, { recursive: true, force: true });
    // Preserve relative symlinks inside the .app bundle. Default cpSync can
    // rewrite them as absolute paths into node_modules, which breaks GPU helpers.
    cpSync(sourceAppRoot, devAppRoot, { recursive: true, verbatimSymlinks: true });
    writeFileSync(versionMarkerPath, electronVersion, 'utf8');
    console.log(`[le-jean-baptiste] Created dev app bundle at ${devAppRoot}`);
  }
};

const patchDevAppMetadata = () => {
  writePlistValue(devPlistPath, 'CFBundleName', APP_NAME);
  writePlistValue(devPlistPath, 'CFBundleDisplayName', APP_NAME);
  writePlistValue(devPlistPath, 'CFBundleIdentifier', DEV_BUNDLE_ID);

  ensurePngIcon();
  const tempIcns = path.join(os.tmpdir(), 'le-jean-baptiste-dev.icns');
  buildIcnsFromPng(pngPath, tempIcns);
  copyFileSync(tempIcns, devBundleIconPath);
  rmSync(tempIcns, { force: true });

  try {
    execFileSync(
      '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
      ['-f', devAppRoot],
      { stdio: 'ignore' },
    );
  } catch {
    // Optional; ignore if unavailable.
  }
};

try {
  syncDevAppBundle();
  patchDevAppMetadata();
  console.log(`[le-jean-baptiste] Dev app ready: ${APP_NAME} (${electronVersion})`);
} catch (error) {
  console.warn('[le-jean-baptiste] Could not prepare branded dev app:', error);
  process.exit(0);
}
