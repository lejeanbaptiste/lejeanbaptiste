import type { EntitySummary } from '../entityOps';
import {
  FAMILY_PREFIX_STRIP_TYPES,
  stripFamilyPrefixFromCourtesyName,
  type NameTypeId,
} from '../nameTypes';
import { suggestPersonNameSplit } from '../../plugins/personNameDefaults';
import { autoRomanize, isLatinScript } from '../../utilities/romanize';
import { isChineseLanguageCode } from '../../utilities/languageCodes';
import type { HygieneFinding, HygienePeer } from './types';

const hasCjk = (text: string): boolean => /\p{Script=Han}/u.test(text);

const nfc = (text: string): string => text.normalize('NFC').trim();

const internalSpaceCount = (text: string): number => (text.trim().match(/ /g) ?? []).length;

/** Comma-junk primaries like "黃, 侃" or "Huang, Kan". */
const looksLikeCommaJunkPrimary = (text: string): boolean =>
  /[,，]\s*\S/.test(text) || /^\S+\s*,\s*\S+$/.test(text);

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

const yearsOverlapOrUnknown = (
  a: { startYear: number | null; endYear: number | null },
  b: { startYear: number | null; endYear: number | null },
): boolean => {
  if (a.startYear == null && a.endYear == null) return true;
  if (b.startYear == null && b.endYear == null) return true;
  const aStart = a.startYear ?? a.endYear!;
  const aEnd = a.endYear ?? a.startYear!;
  const bStart = b.startYear ?? b.endYear!;
  const bEnd = b.endYear ?? b.startYear!;
  return aStart <= bEnd && bStart <= aEnd;
};

const yearsConflict = (
  a: { startYear: number | null; endYear: number | null },
  b: { startYear: number | null; endYear: number | null },
): boolean => {
  if (a.startYear == null || b.startYear == null) return false;
  // Both have birth-ish years more than 40 apart → conflict
  return Math.abs(a.startYear - b.startYear) > 40;
};

const courtesyTexts = (entity: EntitySummary): string[] =>
  entity.nameEntries
    .filter((entry) => entry.type === 'courtesy')
    .map((entry) => nfc(entry.text))
    .filter(Boolean);

const nationalitySet = (entity: EntitySummary): Set<string> =>
  new Set(entity.nationalities.map((label) => nfc(label)).filter(Boolean));

export function scanFamilyPrefixedAltNames(entities: EntitySummary[]): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const familyNames = [
      entity.familyName,
      ...entity.nameEntries.filter((e) => e.type === 'family').map((e) => e.text),
    ]
      .map((name) => (name ? nfc(name) : ''))
      .filter(Boolean);
    if (familyNames.length === 0) continue;

    for (const entry of entity.nameEntries) {
      if (!entry.type || !FAMILY_PREFIX_STRIP_TYPES.has(entry.type)) continue;
      const text = nfc(entry.text);
      const stripped = stripFamilyPrefixFromCourtesyName(text, familyNames);
      if (stripped === text || !stripped) continue;
      findings.push({
        id: `familyPrefixedAltName:${entity.id}:${entry.type}:${text}`,
        kind: 'familyPrefixedAltName',
        entityId: entity.id,
        evidence: `${entry.type} “${text}” starts with 姓 “${familyNames[0]}”`,
        proposal: {
          action: 'stripAltName',
          fromText: text,
          toText: stripped,
          nameType: entry.type,
        },
      });
    }
  }
  return findings;
}

export function scanMissingFamilyOrGiven(
  entities: EntitySummary[],
  projectLang: string | null,
  options?: {
    /** When set, prefer authority-pack 姓/名 over primary-name parsing. */
    packFamilyGiven?: (
      entity: EntitySummary,
    ) => { familyName: string; givenName: string; source: string } | null;
  },
): HygieneFinding[] {
  if (!isChineseLanguageCode(projectLang)) return [];
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    if (entity.familyName && entity.givenName) continue;

    const fromPack = options?.packFamilyGiven?.(entity) ?? null;
    if (fromPack) {
      findings.push({
        id: `missingFamilyOrGiven:${entity.id}`,
        kind: 'missingFamilyOrGiven',
        entityId: entity.id,
        evidence: `Missing 姓/名; ${fromPack.source} has ${fromPack.familyName} + ${fromPack.givenName}`,
        proposal: {
          action: 'setFamilyGiven',
          familyName: fromPack.familyName,
          givenName: fromPack.givenName,
        },
      });
      continue;
    }

    const primary = entity.names.find((name) => hasCjk(name));
    if (!primary) continue;
    const split = suggestPersonNameSplit(primary, projectLang);
    if (!split) continue;
    findings.push({
      id: `missingFamilyOrGiven:${entity.id}`,
      kind: 'missingFamilyOrGiven',
      entityId: entity.id,
      evidence: `Missing 姓/名; parser suggests ${split.familyName} + ${split.givenName}`,
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

export function scanBadRomanization(
  entities: EntitySummary[],
  projectLang: string | null,
): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const romanized = entity.romanized?.trim();
    if (!romanized || !isLatinScript(romanized)) continue;

    const expected = expectedRomanized(entity.familyName, entity.givenName, projectLang);
    const multiSpace = internalSpaceCount(romanized) >= 2;
    const mismatchesExpected = Boolean(expected && nfc(romanized) !== nfc(expected));

    if (!multiSpace && !mismatchesExpected) continue;
    // Only auto-propose when we can compute the concatenated form from 姓+名
    if (!expected) {
      if (multiSpace) {
        findings.push({
          id: `badRomanization:${entity.id}`,
          kind: 'badRomanization',
          entityId: entity.id,
          evidence: `Romanization “${romanized}” has 2+ spaces; add 姓/名 to auto-fix`,
          proposal: { action: 'setRomanized', text: romanized.replace(/\s+/g, ' ').trim() },
        });
      }
      continue;
    }
    if (nfc(romanized) === nfc(expected)) continue;
    findings.push({
      id: `badRomanization:${entity.id}`,
      kind: 'badRomanization',
      entityId: entity.id,
      evidence: multiSpace
        ? `Romanization “${romanized}” should be “${expected}”`
        : `Romanization “${romanized}” ≠ concatenated 姓+名 “${expected}”`,
      proposal: { action: 'setRomanized', text: expected },
    });
  }
  return findings;
}

export function scanBadPrimary(entities: EntitySummary[]): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const primary = entity.names[0]?.trim();
    if (!primary) continue;

    const family = entity.familyName ? nfc(entity.familyName) : '';
    const given = entity.givenName ? nfc(entity.givenName) : '';
    const fromParts = family && given ? `${family}${given}` : null;
    const betterCjk =
      fromParts && hasCjk(fromParts)
        ? fromParts
        : entity.names.find((name) => hasCjk(name) && name !== primary) ?? null;

    const latinOnly = isLatinScript(primary) && !hasCjk(primary);
    const commaJunk = looksLikeCommaJunkPrimary(primary);

    if (!latinOnly && !commaJunk) continue;
    if (!betterCjk || betterCjk === primary) continue;

    findings.push({
      id: `badPrimary:${entity.id}`,
      kind: 'badPrimary',
      entityId: entity.id,
      evidence: commaJunk
        ? `Primary “${primary}” looks malformed; prefer “${betterCjk}”`
        : `Primary is Latin-only “${primary}”; prefer CJK “${betterCjk}”`,
      proposal: { action: 'renamePrimary', text: betterCjk },
    });
  }
  return findings;
}

export function scanEmptyDescription(entities: EntitySummary[]): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.description?.trim()) continue;
    if (entity.authorities.length === 0) continue;
    // Proposal text filled later when pack description is available; placeholder
    // marks the entity so the UI can enrich or skip.
    findings.push({
      id: `emptyDescription:${entity.id}`,
      kind: 'emptyDescription',
      entityId: entity.id,
      evidence: 'Empty description with linked authority',
      proposal: { action: 'setDescription', text: '' },
    });
  }
  return findings;
}

export function scanRejectedBlockingGoodName(
  entities: EntitySummary[],
  preferredByEntityId: Map<string, string[]>,
): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const preferred = preferredByEntityId.get(entity.id) ?? [];
    if (preferred.length === 0) continue;
    const active = new Set(entity.names.map(nfc));
    for (const assertion of entity.assertions) {
      if (assertion.element !== 'persName') continue;
      if (assertion.status !== 'rejected' && assertion.status !== 'withdrawn') continue;
      const text = nfc(assertion.value);
      if (!text || active.has(text)) continue;
      if (!preferred.some((pref) => nfc(pref) === text)) continue;
      findings.push({
        id: `rejectedBlockingGoodName:${entity.id}:${assertion.key}`,
        kind: 'rejectedBlockingGoodName',
        entityId: entity.id,
        evidence: `Rejected name “${text}” matches authority preferred form`,
        proposal: { action: 'restoreName', assertionKey: assertion.key, text },
      });
    }
  }
  return findings;
}

export function findingsFromAuthorityDuplicates(
  groups: Array<{ type: string; value: string; entityIds: string[] }>,
): HygieneFinding[] {
  return groups
    .filter((group) => group.entityIds.length >= 2)
    .map((group) => {
      const [keepId, ...dropIds] = group.entityIds;
      return {
        id: `authorityIdDuplicate:${group.type}:${group.value}:${group.entityIds.join(',')}`,
        kind: 'authorityIdDuplicate' as const,
        entityId: keepId!,
        relatedEntityIds: group.entityIds,
        peer: { kind: 'entity' as const, entityId: dropIds[0] ?? keepId! },
        evidence: `Same ${group.type} id ${group.value} on ${group.entityIds.length} entities`,
        proposal: {
          action: 'merge' as const,
          keepId: keepId!,
          dropIds,
        },
      };
    });
}

/**
 * Near-duplicates: require ≥2 agreeing signals among
 * primary/alt name, 姓+名, 姓+字, nationality, year overlap.
 *
 * Indexed by shared-name buckets so cost is ~sum(bucket²) instead of n².
 */
export function scanNearDuplicates(entities: EntitySummary[]): HygieneFinding[] {
  const people = entities.filter((entity) => entity.kind === 'person');
  const findings: HygieneFinding[] = [];
  const seenPairs = new Set<string>();

  const addToBucket = (buckets: Map<string, EntitySummary[]>, key: string, entity: EntitySummary) => {
    if (!key) return;
    const list = buckets.get(key);
    if (list) list.push(entity);
    else buckets.set(key, [entity]);
  };

  const bySharedName = new Map<string, EntitySummary[]>();
  const byFamilyGiven = new Map<string, EntitySummary[]>();
  const byFamilyZi = new Map<string, EntitySummary[]>();

  for (const person of people) {
    for (const name of person.names) {
      const key = nfc(name);
      if (key && hasCjk(key)) addToBucket(bySharedName, key, person);
    }
    if (person.familyName && person.givenName) {
      addToBucket(
        byFamilyGiven,
        `${nfc(person.familyName)}\0${nfc(person.givenName)}`,
        person,
      );
    }
    if (person.familyName) {
      const family = nfc(person.familyName);
      for (const zi of courtesyTexts(person)) {
        addToBucket(byFamilyZi, `${family}\0${zi}`, person);
      }
    }
  }

  const candidatePairs: Array<[EntitySummary, EntitySummary]> = [];
  const pushPairsFromBucket = (bucket: EntitySummary[]) => {
    if (bucket.length < 2 || bucket.length > 80) return; // huge buckets are too noisy / costly
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        candidatePairs.push([bucket[i]!, bucket[j]!]);
      }
    }
  };
  for (const bucket of bySharedName.values()) pushPairsFromBucket(bucket);
  for (const bucket of byFamilyGiven.values()) pushPairsFromBucket(bucket);
  for (const bucket of byFamilyZi.values()) pushPairsFromBucket(bucket);

  for (const [a, b] of candidatePairs) {
    if (yearsConflict(a, b)) continue;

    let signals = 0;
    const reasons: string[] = [];

    const aPrimary = nfc(a.names[0] ?? '');
    const bPrimary = nfc(b.names[0] ?? '');
    const aNames = new Set(a.names.map(nfc).filter(Boolean));
    const bNames = new Set(b.names.map(nfc).filter(Boolean));
    const sharedName =
      (aPrimary && bNames.has(aPrimary)) ||
      (bPrimary && aNames.has(bPrimary)) ||
      [...aNames].some((name) => bNames.has(name) && hasCjk(name));
    if (sharedName) {
      signals += 1;
      reasons.push('shared name form');
    }

    if (a.familyName && a.givenName && b.familyName && b.givenName) {
      if (nfc(a.familyName) === nfc(b.familyName) && nfc(a.givenName) === nfc(b.givenName)) {
        signals += 1;
        reasons.push('same 姓+名');
      }
    }

    if (a.familyName && b.familyName && nfc(a.familyName) === nfc(b.familyName)) {
      const aZi = courtesyTexts(a);
      const bZi = courtesyTexts(b);
      if (aZi.some((zi) => bZi.includes(zi))) {
        signals += 1;
        reasons.push('same 姓+字');
      }
    }

    const aNat = nationalitySet(a);
    const bNat = nationalitySet(b);
    if ([...aNat].some((label) => bNat.has(label))) {
      signals += 1;
      reasons.push('shared dynasty/nationality');
    }

    if (
      yearsOverlapOrUnknown(a, b) &&
      (a.startYear != null || a.endYear != null) &&
      (b.startYear != null || b.endYear != null)
    ) {
      signals += 1;
      reasons.push('overlapping years');
    }

    if (signals < 2) continue;

    const pairKey = [a.id, b.id].sort().join('\0');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const [keepId, dropId] = [a.id, b.id].sort();
    findings.push({
      id: `nearDuplicate:${pairKey}`,
      kind: 'nearDuplicate',
      entityId: keepId!,
      relatedEntityIds: [a.id, b.id],
      peer: { kind: 'entity', entityId: dropId! },
      evidence: reasons.join('; '),
      proposal: { action: 'merge', keepId: keepId!, dropIds: [dropId!] },
    });
  }
  return findings;
}

export interface UnlinkedHitInput {
  entity: EntitySummary;
  peers: Extract<HygienePeer, { kind: 'authority' }>[];
}

/**
 * High-confidence unlinked pack hits. Suppress when more than one peer remains
 * after corroboration (ambiguous).
 */
export function scanUnlinkedAuthorityHits(inputs: UnlinkedHitInput[]): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const { entity, peers } of inputs) {
    if (entity.kind !== 'person') continue;
    const hasCbdbOrDila = entity.authorities.some((auth) => {
      const type = auth.type.toLowerCase();
      return type === 'cbdb' || type === 'dila';
    });
    if (hasCbdbOrDila) continue;
    if (peers.length !== 1) continue;
    const peer = peers[0]!;
    findings.push({
      id: `unlinkedAuthorityHit:${entity.id}:${peer.authorityType}:${peer.authorityValue}`,
      kind: 'unlinkedAuthorityHit',
      entityId: entity.id,
      peer,
      evidence: `No ${peer.authorityType} link; pack hit “${peer.primaryName}”`,
      proposal: {
        action: 'attachAuthority',
        authorityType: peer.authorityType,
        authorityValue: peer.authorityValue,
      },
    });
  }
  return findings;
}

/** Corroborate a pack row against an entity (for unlinked-hit filtering). */
export function corroboratePackPeer(
  entity: EntitySummary,
  peer: Extract<HygienePeer, { kind: 'authority' }>,
): boolean {
  // Exact CJK primary or alt match is required by the caller; here we add
  // dynasty / year / 字 corroboration when the pack provides those fields.
  const softSignals: boolean[] = [];

  if (peer.nationalities && peer.nationalities.length > 0) {
    const entityNat = nationalitySet(entity);
    softSignals.push(peer.nationalities.some((label) => entityNat.has(nfc(label))));
  }
  if (peer.startYear != null || peer.endYear != null) {
    softSignals.push(
      !yearsConflict(entity, {
        startYear: peer.startYear ?? null,
        endYear: peer.endYear ?? null,
      }) &&
        yearsOverlapOrUnknown(entity, {
          startYear: peer.startYear ?? null,
          endYear: peer.endYear ?? null,
        }),
    );
  }
  if (peer.courtesyNames && peer.courtesyNames.length > 0) {
    const entityZi = new Set(courtesyTexts(entity));
    softSignals.push(peer.courtesyNames.some((zi) => entityZi.has(nfc(zi))));
  }

  // If pack has no corroborating fields, exact name match alone is enough.
  if (softSignals.length === 0) return true;
  // If pack has corroborating fields, at least one must agree (and none hard-fail years).
  return softSignals.some(Boolean);
}

export function runDeterministicScanners(
  entities: EntitySummary[],
  projectLang: string | null,
): HygieneFinding[] {
  return [
    ...scanFamilyPrefixedAltNames(entities),
    ...scanMissingFamilyOrGiven(entities, projectLang),
    ...scanBadRomanization(entities, projectLang),
    ...scanBadPrimary(entities),
    ...scanEmptyDescription(entities),
    ...scanNearDuplicates(entities),
  ];
}
