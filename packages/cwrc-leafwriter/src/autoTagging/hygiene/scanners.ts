import type { EntitySummary } from '../entityOps';
import {
  FAMILY_PREFIX_STRIP_TYPES,
  stripFamilyPrefixFromCourtesyName,
} from '../nameTypes';
import { suggestPersonNameSplit } from '../../plugins/personNameDefaults';
import { isLatinScript } from '../../utilities/romanize';
import { isChineseLanguageCode } from '../../utilities/languageCodes';
import { isNobleTitleHeadword } from '../nobleTitleHeadword';
import type { HygieneFinding, HygienePeer } from './types';

const hasCjk = (text: string): boolean => /\p{Script=Han}/u.test(text);

const nfc = (text: string): string => text.normalize('NFC').trim();

const codePointLength = (value: string): number => [...nfc(value)].length;

/** Comma-junk primaries like "黃, 侃" or "Huang, Kan". */
const looksLikeCommaJunkPrimary = (text: string): boolean =>
  /[,，]\s*\S/.test(text) || /^\S+\s*,\s*\S+$/.test(text);

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

const familyTexts = (entity: EntitySummary): string[] => {
  const out = new Set<string>();
  if (entity.familyName) out.add(nfc(entity.familyName));
  for (const entry of entity.nameEntries) {
    if (entry.type === 'family') {
      const text = nfc(entry.text);
      if (text) out.add(text);
    }
  }
  return [...out];
};

const givenTexts = (entity: EntitySummary): string[] => {
  const out = new Set<string>();
  if (entity.givenName) out.add(nfc(entity.givenName));
  for (const entry of entity.nameEntries) {
    if (entry.type === 'given') {
      const text = nfc(entry.text);
      if (text) out.add(text);
    }
  }
  return [...out];
};

const nationalitySet = (entity: EntitySummary): Set<string> =>
  new Set(entity.nationalities.map((label) => nfc(label)).filter(Boolean));

const originSet = (entity: EntitySummary): Set<string> =>
  new Set(entity.placesOfOrigin.map((label) => nfc(label)).filter(Boolean));

const appointmentSet = (entity: EntitySummary): Set<string> =>
  new Set(entity.roles.map((label) => nfc(label)).filter(Boolean));

const nobleTitleSet = (entity: EntitySummary): Set<string> =>
  new Set(
    entity.nobleTitles
      .map((title) =>
        nfc([title.fief, title.posthumousName, title.title].filter(Boolean).join('')),
      )
      .filter(Boolean),
  );

const setsIntersect = (a: Set<string>, b: Set<string>): boolean => {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
};

const listsIntersect = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  const other = new Set(b);
  return a.some((value) => other.has(value));
};

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

    // 2–4 character orphans without authorities are owned by autoCleanEntities.
    if (entity.authorities.length === 0 && !entity.familyName && !entity.givenName) {
      const primary = entity.names.find((name) => hasCjk(name));
      if (primary) {
        const len = codePointLength(primary);
        if (len >= 2 && len <= 4) continue;
      }
    }

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
    if (isNobleTitleHeadword(primary)) continue;
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

/**
 * Manual-review romanization issues.
 *
 * Pinyin that matches any family×given pair (letter-for-letter, ignoring only
 * joinable spaces) is treated as OK. Spacing/capital joins like
 * "Li Chun Feng" → "Li Chunfeng" are handled by {@link autoCleanEntities}, not
 * the review queue — so this scanner returns nothing for that case.
 */
export function scanBadRomanization(
  _entities: EntitySummary[],
  _projectLang: string | null,
): HygieneFinding[] {
  return [];
}

export function scanBadPrimary(entities: EntitySummary[]): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    const primary = entity.names[0]?.trim();
    if (!primary) continue;

    const family = entity.familyName ? nfc(entity.familyName) : '';
    const given = entity.givenName ? nfc(entity.givenName) : '';
    // Only 姓+名 is a trustworthy reconstructed primary. Bare 姓 (common when
    // Wikidata has P734 but no Chinese label/名) is not a full personal name.
    const fromParts = family && given ? `${family}${given}` : null;

    const betterCjk =
      fromParts && hasCjk(fromParts)
        ? fromParts
        : entity.nameEntries.find((entry) => {
            const text = nfc(entry.text);
            if (!text || !hasCjk(text) || text === nfc(primary)) return false;
            // Structural parts are not display primaries.
            if (entry.type === 'family' || entry.type === 'given') return false;
            // Same surface as bare 姓 / 名 alone — still not a full headword.
            if (family && text === family) return false;
            if (given && text === given) return false;
            // Single-character CJK is almost always a surname fragment here.
            if (codePointLength(text) < 2) return false;
            return true;
          })?.text ?? null;

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
  groups: { type: string; value: string; entityIds: string[] }[],
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
 * Near-duplicates (persons). All three gates are required:
 *   1. 姓 = 姓
 *   2. 名 = 名  OR  名 = 字  OR  字 = 字
 *   3. shared place of origin OR nationality OR appointment OR noble title
 *
 * Score = number of atomic matches beyond that minimum of three; findings are
 * sorted highest score first. Year overlap is not a positive signal; birth
 * years >40 apart still veto a pair.
 *
 * Indexed by 姓, then by 名/字, so cost stays near sum(bucket²) not n².
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

  /** family → people who carry that 姓 */
  const byFamily = new Map<string, EntitySummary[]>();
  for (const person of people) {
    for (const family of familyTexts(person)) {
      addToBucket(byFamily, family, person);
    }
  }

  interface ScoredPair {
    a: EntitySummary;
    b: EntitySummary;
    score: number;
    reasons: string[];
  }
  const scored: ScoredPair[] = [];

  for (const familyBucket of byFamily.values()) {
    if (familyBucket.length < 2) continue;

    // Dedup people who appear twice under the same 姓 via nameEntries.
    const unique = [...new Map(familyBucket.map((p) => [p.id, p])).values()];
    if (unique.length < 2) continue;

    const byGiven = new Map<string, EntitySummary[]>();
    const byZi = new Map<string, EntitySummary[]>();
    for (const person of unique) {
      for (const given of givenTexts(person)) addToBucket(byGiven, given, person);
      for (const zi of courtesyTexts(person)) addToBucket(byZi, zi, person);
    }

    /** Candidate pairs that already share 姓 and at least one 名/字 link. */
    const candidatePairs: [EntitySummary, EntitySummary][] = [];
    const pushPairs = (bucket: EntitySummary[]) => {
      const members = [...new Map(bucket.map((p) => [p.id, p])).values()];
      if (members.length < 2 || members.length > 120) return;
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          candidatePairs.push([members[i]!, members[j]!]);
        }
      }
    };
    for (const bucket of byGiven.values()) pushPairs(bucket);
    for (const bucket of byZi.values()) pushPairs(bucket);

    // 名 = 字 cross-links (A's 名 equals B's 字, and vice versa).
    for (const [surface, givenHolders] of byGiven) {
      const ziHolders = byZi.get(surface);
      if (!ziHolders?.length) continue;
      for (const a of givenHolders) {
        for (const b of ziHolders) {
          if (a.id === b.id) continue;
          candidatePairs.push(a.id < b.id ? [a, b] : [b, a]);
        }
      }
    }

    for (const [a, b] of candidatePairs) {
      if (yearsConflict(a, b)) continue;

      const pairKey = [a.id, b.id].sort().join('\0');
      if (seenPairs.has(pairKey)) continue;

      const aFamily = familyTexts(a);
      const bFamily = familyTexts(b);
      if (!listsIntersect(aFamily, bFamily)) continue;

      const aGiven = givenTexts(a);
      const bGiven = givenTexts(b);
      const aZi = courtesyTexts(a);
      const bZi = courtesyTexts(b);

      const givenGiven = listsIntersect(aGiven, bGiven);
      const givenZi =
        listsIntersect(aGiven, bZi) || listsIntersect(bGiven, aZi);
      const ziZi = listsIntersect(aZi, bZi);
      if (!givenGiven && !givenZi && !ziZi) continue;

      const sharedOrigin = setsIntersect(originSet(a), originSet(b));
      const sharedNationality = setsIntersect(nationalitySet(a), nationalitySet(b));
      const sharedAppointment = setsIntersect(appointmentSet(a), appointmentSet(b));
      const sharedNoble = setsIntersect(nobleTitleSet(a), nobleTitleSet(b));
      if (!sharedOrigin && !sharedNationality && !sharedAppointment && !sharedNoble) {
        continue;
      }

      seenPairs.add(pairKey);

      const reasons: string[] = ['姓'];
      let atomic = 1; // 姓 gate
      if (givenGiven) {
        atomic += 1;
        reasons.push('名=名');
      }
      if (givenZi) {
        atomic += 1;
        reasons.push('名=字');
      }
      if (ziZi) {
        atomic += 1;
        reasons.push('字=字');
      }
      if (sharedOrigin) {
        atomic += 1;
        reasons.push('origin');
      }
      if (sharedNationality) {
        atomic += 1;
        reasons.push('nationality');
      }
      if (sharedAppointment) {
        atomic += 1;
        reasons.push('appointment');
      }
      if (sharedNoble) {
        atomic += 1;
        reasons.push('noble title');
      }

      // Minimum is three atomic matches (姓 + one name-part + one context).
      const score = atomic - 3;
      scored.push({ a, b, score, reasons });
    }
  }

  scored.sort((left, right) => right.score - left.score || left.a.id.localeCompare(right.a.id));

  for (const { a, b, score, reasons } of scored) {
    const [keepId, dropId] = [a.id, b.id].sort();
    findings.push({
      id: `nearDuplicate:${[a.id, b.id].sort().join('\0')}`,
      kind: 'nearDuplicate',
      entityId: keepId!,
      relatedEntityIds: [a.id, b.id],
      peer: { kind: 'entity', entityId: dropId! },
      evidence:
        score > 0
          ? `${reasons.join('; ')} (+${score} beyond minimum)`
          : reasons.join('; '),
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
  // familyPrefixedAltName + joinable romanization + orphan short splits are
  // applied by autoCleanEntities (mechanical), not the review queue.
  return [
    ...scanMissingFamilyOrGiven(entities, projectLang),
    ...scanBadPrimary(entities),
    ...scanEmptyDescription(entities),
    ...scanNearDuplicates(entities),
  ];
}
