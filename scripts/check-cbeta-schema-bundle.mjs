#!/usr/bin/env node
/**
 * Guards the bundled CBETA P5 schema (`apps/desktop/resources/schema/cbeta_p5.rng`)
 * against shipping a stale or un-loosened copy.
 *
 * The file is a build artifact of the cbeta-import plugin's `scripts/loosen_schema.py`
 * ("ljb-cbeta-loosen v2") — it takes CBETA's published RelaxNG and widens it:
 *
 *   - the NE inventory (persName/placeName/orgName/roleName/name/title/date/
 *     nobleTitle) added to `tei_model.phrase`;
 *   - `@ref` / `@key` on the authority-bearing elements;
 *   - `<date>` extended with the Sanmiao parse children + resolution attributes,
 *     which MUST match `apps/desktop/src/sanmiaoSchemaMerge.ts` SANMIAO_DATE_PARTS;
 *   - `tei_div` matches both `<cb:div>` and TEI `<div>` so the Daozang / Kanripo /
 *     Wikisource / BDRC importers (which emit plain `<div>`) share this target.
 *
 * If this check fails, re-run `loosen_schema.py` in the plugins repo and copy the
 * output over the bundled file (and `cbeta.css` stays as-is).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RNG = path.join(repoRoot, 'apps/desktop/resources/schema/cbeta_p5.rng');
const MERGE = path.join(repoRoot, 'apps/desktop/src/sanmiaoSchemaMerge.ts');

const fail = (msg) => {
  console.error(`✗ cbeta schema bundle: ${msg}`);
  process.exitCode = 1;
};

if (!fs.existsSync(RNG)) {
  fail(`missing bundled schema at ${path.relative(repoRoot, RNG)}`);
  process.exit();
}

const rng = fs.readFileSync(RNG, 'utf8');

if (!/ljb-cbeta-loosen v2/.test(rng)) {
  fail('bundled cbeta_p5.rng is not "ljb-cbeta-loosen v2" — re-run loosen_schema.py and re-bundle');
}

// v2: tei_div must accept both the CBETA and the TEI namespace, so non-CBETA
// importers' plain <div> validates in <body>.
const divDefine = rng.match(/<define name="tei_div">[\s\S]*?<zeroOrMore>/)?.[0] ?? '';
if (
  !/<name ns="http:\/\/www\.cbeta\.org\/ns\/1\.0">div<\/name>/.test(divDefine) ||
  !/<name ns="http:\/\/www\.tei-c\.org\/ns\/1\.0">div<\/name>/.test(divDefine)
) {
  fail(
    'tei_div is not dual-namespace — Daozang/Kanripo/Wikisource <div> will be rejected in <body>',
  );
}

const NE_REFS = [
  'tei_persName',
  'tei_placeName',
  'tei_orgName',
  'tei_roleName',
  'tei_name',
  'tei_title',
  'tei_date',
  'ljb_nobleTitle',
];
const phraseBlock = rng.match(/<define name="tei_model\.phrase">[\s\S]*?<\/define>/)?.[0] ?? '';
for (const ref of NE_REFS) {
  if (!phraseBlock.includes(`name="${ref}"`)) {
    fail(`tei_model.phrase is missing <ref name="${ref}"/> — NE tagging will not validate`);
  }
}

// Sanmiao date parts must be present as ljb_sanmiao_<part> defines and must
// match the desktop merge's list exactly.
const mergeSrc = fs.readFileSync(MERGE, 'utf8');
const mergeParts = (
  mergeSrc.match(/const SANMIAO_DATE_PARTS = \[([\s\S]*?)\] as const;/)?.[1] ?? ''
)
  .split(',')
  .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

if (mergeParts.length === 0) {
  fail('could not parse SANMIAO_DATE_PARTS from sanmiaoSchemaMerge.ts');
}

for (const part of mergeParts) {
  if (!rng.includes(`name="ljb_sanmiao_${part}"`)) {
    fail(
      `bundled schema is missing sanmiao date part define "ljb_sanmiao_${part}" (drift from sanmiaoSchemaMerge.ts)`,
    );
  }
}

if (!process.exitCode) {
  console.log(
    `✓ cbeta schema bundle: loosened, ${NE_REFS.length} NE refs, ${mergeParts.length} sanmiao parts`,
  );
}
