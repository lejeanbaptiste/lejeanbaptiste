/**
 * Mechanical database cleaning — applied immediately (no review queue).
 *
 * Rules (in order):
 * 1. 字/號/法號 that begin with 姓 → strip 姓, tombstone the compound form
 * 2. 2–4 character primary, no authorities, missing 姓/名 → Norbert/plugin parser
 * 3. Duplicate rows with the same text + name type → keep one, tombstone the rest
 * 4. Names with no name type (after promoting Latn romanizations to `translation`) → remove
 * 5. Romanization that only differs by joinable spaces/capitals → set preferred 姓+名 form
 */

import type { EntityStore } from '../entityStore';
import type { EntitySummary } from '../entityOps';
import { suggestPersonNameSplit } from '../../plugins/personNameDefaults';
import { autoRomanize, isLatinScript } from '../../utilities/romanize';
import { isChineseLanguageCode } from '../../utilities/languageCodes';
import { applyHygieneFinding } from './apply';
import { scanFamilyPrefixedAltNames } from './scanners';
import type { HygieneFinding } from './types';

export type AutoCleanReport = {
  strippedFamilyPrefixed: number;
  parsedFamilyGiven: number;
  dedupedNames: number;
  removedUntyped: number;
  promotedRomanizations: number;
  fixedRomanization: number;
};

const nfc = (value: string) => value.normalize('NFC');

const codePointLength = (value: string): number => [...nfc(value)].length;

const hasCjk = (value: string): boolean => /\p{Script=Han}/u.test(value);

/** Collapse spaces for comparison so "Tuoba Jian" ≡ "Tuobajian". */
export const collapseRomanizationSpaces = (value: string): string =>
  value.replace(/\s+/g, '').toLowerCase();

/**
 * True when actual and preferred spell the same letters and the only edits are
 * spaces (typically before capitals), e.g. "Li Chun Feng" → "Li Chunfeng".
 */
export function isJoinableRomanizationDiff(actual: string, preferred: string): boolean {
  const a = actual.trim();
  const p = preferred.trim();
  if (!a || !p || a === p) return false;
  return collapseRomanizationSpaces(a) === collapseRomanizationSpaces(p);
}

const expectedRomanized = (
  familyName: string | null,
  givenName: string | null,
  projectLang: string | null,
): string | null => {
  if (!familyName || !givenName) return null;
  const family = autoRomanize(familyName, projectLang, { concatenate: true });
  const given = autoRomanize(givenName, projectLang, { concatenate: true });
  if (family && given) return `${family} ${given}`;
  return null;
};

/** Parser fill only for short orphan primaries (no authority link, no 姓/名). */
export function scanOrphanShortNameSplits(
  entities: EntitySummary[],
  projectLang: string | null,
): HygieneFinding[] {
  if (!isChineseLanguageCode(projectLang)) return [];
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    if (entity.authorities.length > 0) continue;
    if (entity.familyName || entity.givenName) continue;
    const primary = entity.names.find((name) => hasCjk(name))?.trim();
    if (!primary) continue;
    const len = codePointLength(primary);
    if (len < 2 || len > 4) continue;
    const split = suggestPersonNameSplit(primary, projectLang);
    if (!split) continue;
    findings.push({
      id: `orphanShortNameSplit:${entity.id}`,
      kind: 'missingFamilyOrGiven',
      entityId: entity.id,
      evidence: `No authority; ${len}-character primary → parser ${split.familyName}+${split.givenName}`,
      proposal: {
        action: 'setFamilyGiven',
        familyName: split.familyName,
        givenName: split.givenName,
        romanizedName: split.romanizedName,
      },
    });
  }
  return findings;
}

export function scanJoinableRomanizations(
  entities: EntitySummary[],
  projectLang: string | null,
): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const romanized = entity.romanized?.trim();
    if (!romanized || !isLatinScript(romanized)) continue;
    const preferred = expectedRomanized(entity.familyName, entity.givenName, projectLang);
    if (!preferred) continue;
    if (nfc(romanized) === nfc(preferred)) continue;
    if (!isJoinableRomanizationDiff(romanized, preferred)) continue;
    findings.push({
      id: `joinableRomanization:${entity.id}`,
      kind: 'badRomanization',
      entityId: entity.id,
      evidence: `Romanization “${romanized}” joins to “${preferred}”`,
      proposal: { action: 'setRomanized', text: preferred },
    });
  }
  return findings;
}

/**
 * Apply mechanical cleans and write to SQLite immediately.
 * Call {@link EntityStore.sqliteAutoCleanNames} for dedupe / untyped rows.
 */
export async function autoCleanEntities(
  store: EntityStore,
  entities: EntitySummary[],
  projectLang: string | null,
  options?: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number, detail: string) => void;
  },
): Promise<AutoCleanReport> {
  const report: AutoCleanReport = {
    strippedFamilyPrefixed: 0,
    parsedFamilyGiven: 0,
    dedupedNames: 0,
    removedUntyped: 0,
    promotedRomanizations: 0,
    fixedRomanization: 0,
  };

  const people = entities.filter((entity) => entity.kind === 'person');
  const stripFindings = scanFamilyPrefixedAltNames(people);
  const orphanFindings = scanOrphanShortNameSplits(people, projectLang);
  const romanFindings = scanJoinableRomanizations(people, projectLang);

  const findingBatches: Array<{
    label: string;
    findings: HygieneFinding[];
    key: 'strippedFamilyPrefixed' | 'parsedFamilyGiven' | 'fixedRomanization';
  }> = [
    { label: 'Strip 姓 from 字/號/法號', findings: stripFindings, key: 'strippedFamilyPrefixed' },
    { label: 'Parse orphan short names', findings: orphanFindings, key: 'parsedFamilyGiven' },
    { label: 'Join romanization spaces', findings: romanFindings, key: 'fixedRomanization' },
  ];

  let done = 0;
  const total =
    stripFindings.length + orphanFindings.length + romanFindings.length + 1; /* batch name ops */

  for (const batch of findingBatches) {
    for (const finding of batch.findings) {
      if (options?.signal?.aborted) return report;
      options?.onProgress?.(done, total, batch.label);
      try {
        await applyHygieneFinding(store, finding);
        report[batch.key] += 1;
      } catch {
        // Skip one failure; continue the rest.
      }
      done += 1;
    }
  }

  options?.onProgress?.(done, total, 'Deduplicate & remove untyped names…');
  if (typeof store.sqliteAutoCleanNames === 'function') {
    const batch = await store.sqliteAutoCleanNames();
    report.dedupedNames = batch.dedupedNames;
    report.removedUntyped = batch.removedUntyped;
    report.promotedRomanizations = batch.promotedRomanizations;
  }
  done += 1;
  options?.onProgress?.(done, total, 'Auto-clean complete');

  return report;
}
