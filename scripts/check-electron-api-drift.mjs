#!/usr/bin/env node
/**
 * Guards the three hand-maintained declarations of the Electron bridge against
 * drifting apart:
 *
 *   apps/desktop/src/preload.ts              `ElectronAPI`           — the implementation
 *   apps/commons/src/types/desktop.ts        `ElectronAPI`           — renderer consumer
 *   packages/cwrc-leafwriter/src/types/globals.d.ts `LeafWriterElectronApi` — editor consumer
 *
 * Both consumers also augment `Window.electronAPI`, so which one wins depends on
 * the tsconfig you compile from — that is what made the `maxZoom` bug (a field
 * present in preload but missing from commons) surface as a confusing, config-
 * dependent error rather than a clear one. Until the three are merged into a
 * single shared type, this check keeps them honest.
 *
 * Two rules, both anchored on preload as the source of truth:
 *
 *   1. A consumer may not declare a member preload does not implement. Such a
 *      member type-checks at every call site and then is `undefined` at runtime.
 *   2. A consumer may not declare a member REQUIRED that preload marks optional.
 *      Required means call sites invoke it without `?.`, which throws if the
 *      preload build genuinely omits it.
 *
 * The reverse (consumer optional, preload required) is safe and expected: a
 * redundant `?.` is harmless, so it is not reported.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_OF_TRUTH = {
  label: 'preload',
  file: 'apps/desktop/src/preload.ts',
  interface: 'ElectronAPI',
};

const CONSUMERS = [
  { label: 'apps/commons', file: 'apps/commons/src/types/desktop.ts', interface: 'ElectronAPI' },
  {
    label: 'cwrc-leafwriter',
    file: 'packages/cwrc-leafwriter/src/types/globals.d.ts',
    interface: 'LeafWriterElectronApi',
  },
];

/** Map of member name -> isOptional for one interface declaration. */
const readMembers = ({ file, interface: name, label }) => {
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute)) {
    throw new Error(`${label}: ${file} not found — did the file move?`);
  }
  const sourceFile = ts.createSourceFile(
    absolute,
    fs.readFileSync(absolute, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const members = new Map();
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      for (const member of node.members) {
        if (member.name) members.set(member.name.getText(sourceFile), !!member.questionToken);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (members.size === 0) {
    throw new Error(`${label}: interface \`${name}\` not found in ${file} — did it get renamed?`);
  }
  return members;
};

const truth = readMembers(SOURCE_OF_TRUTH);
const problems = [];

for (const consumer of CONSUMERS) {
  const members = readMembers(consumer);
  for (const [member, isOptional] of members) {
    if (!truth.has(member)) {
      problems.push(
        `${consumer.label}: declares \`${member}\`, which ${SOURCE_OF_TRUTH.label} does not implement — ` +
          `call sites will type-check and then get undefined at runtime.`,
      );
      continue;
    }
    if (!isOptional && truth.get(member) === true) {
      problems.push(
        `${consumer.label}: declares \`${member}\` as required, but ${SOURCE_OF_TRUTH.label} marks it optional — ` +
          `call sites may invoke it without \`?.\` and throw.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Electron bridge declarations have drifted:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nFix the consumer declaration to match ${SOURCE_OF_TRUTH.file}, ` +
      `or implement the member there if it is genuinely missing.`,
  );
  process.exit(1);
}

const counts = CONSUMERS.map((c) => `${c.label} ${readMembers(c).size}`).join(', ');
console.log(`electron-api drift check passed (${SOURCE_OF_TRUTH.label} ${truth.size}; ${counts})`);
