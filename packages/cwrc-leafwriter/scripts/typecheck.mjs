import { spawnSync } from 'node:child_process';

// `@src/*` is defined by both this package's and apps/commons's tsconfig, each pointing
// at its own src/. This package's isolated `tsc` run legitimately pulls in a handful of
// commons files (small cross-package imports), and the alias then resolves against the
// wrong package's directory for those files — producing errors under `../../apps/commons/`
// that don't reflect real problems here. This package's actual build is webpack, which
// never runs bare `tsc -p tsconfig.json`, so nothing in the real pipeline hits this.
// See CHANGELOG.md, 0.1.0-beta.2 "Tooling", for the investigation that confirmed this.
const KNOWN_NOISE_PREFIX = '../../apps/commons/';

const result = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const lines = `${result.stdout}${result.stderr}`.split('\n').filter((line) => line.trim());
const realErrors = lines.filter((line) => !line.startsWith(KNOWN_NOISE_PREFIX));

if (realErrors.length > 0) {
  console.error(realErrors.join('\n'));
  process.exit(1);
}

if (lines.length > 0) {
  console.log(
    `typecheck passed (${lines.length} known cross-package @src/* alias artifact(s) ignored)`,
  );
} else {
  console.log('typecheck passed');
}
