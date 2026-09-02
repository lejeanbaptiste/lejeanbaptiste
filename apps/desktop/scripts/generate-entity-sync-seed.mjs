#!/usr/bin/env node
/**
 * Wrapper: generate SQL to seed the entity-sync D1 database out of band.
 * See generate-entity-sync-seed.ts for behaviour and usage.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'generate-entity-sync-seed.ts');
const leafWriterRoot = path.resolve(__dirname, '../../..');
const domStub = path.join(__dirname, 'node-dom-stub.cjs');

const result = spawnSync(
  process.execPath,
  ['-r', domStub, '-r', 'ts-node/register/transpile-only', script, ...process.argv.slice(2)],
  {
    cwd: leafWriterRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        skipLibCheck: true,
      }),
    },
  },
);

process.exit(result.status ?? 1);
