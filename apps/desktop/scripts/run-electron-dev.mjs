/**
 * Launch the branded dev .app bundle (Dock / Cmd+Tab show "Le Jean-Baptiste").
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const executable = path.join(
  desktopRoot,
  '.dev/Le Jean-Baptiste.app/Contents/MacOS/Electron',
);

if (!existsSync(executable)) {
  console.error(
    '[le-jean-baptiste] Branded dev app not found. Run: npm run brand-electron -w le-jean-baptiste-desktop',
  );
  process.exit(1);
}

const child = spawn(executable, process.argv.slice(2).length ? process.argv.slice(2) : ['.'], {
  cwd: desktopRoot,
  stdio: 'inherit',
  env: (() => {
    const env = { ...process.env };
    // Cursor and some IDEs set this, which makes Electron run as plain Node.js
    // so require('electron') returns a path string instead of the API object.
    delete env.ELECTRON_RUN_AS_NODE;
    return env;
  })(),
});

child.on('close', (code, signal) => {
  if (code === null) {
    console.error(executable, 'exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
