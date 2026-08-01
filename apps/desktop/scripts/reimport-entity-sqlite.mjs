#!/usr/bin/env node
/**
 * Wrapper: rebuild entities.sqlite from sibling entities.xml.
 * See reimport-entity-sqlite.ts for behaviour.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'reimport-entity-sqlite.ts');
const leafWriterRoot = path.resolve(__dirname, '../../..');

const result = spawnSync(
  process.execPath,
  ['-r', 'ts-node/register/transpile-only', script, ...process.argv.slice(2)],
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
