import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const tag = process.argv[2]?.trim();
const match =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
    tag ?? '',
  );

const hasInvalidNumericPrerelease = match?.[4]
  ?.split('.')
  .some((identifier) => /^0\d+$/.test(identifier));

if (!match || hasInvalidNumericPrerelease) {
  throw new Error(
    `Release tag must be a semantic version such as v1.2.3; received ${JSON.stringify(tag)}`,
  );
}

const version = tag.replace(/^v/, '');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(repoRoot, 'apps', 'desktop', 'package.json');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

// Single source of truth for the shipped app version: Electron's app.getVersion()
// (About dialog, updater, installer) all read this field.
packageJson.version = version;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
process.stdout.write(`Desktop release version set to ${version}\n`);
