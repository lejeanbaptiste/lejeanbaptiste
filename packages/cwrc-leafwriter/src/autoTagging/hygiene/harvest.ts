import type { EntityDataAssertion } from '../../plugins/entityDataExtractors';
import type { EntitySummary } from '../entityOps';
import { personWrapperSource } from '../entityExtraction';
import type { HygieneFinding } from './types';

/**
 * Builtin TEI person-wrapper harvest (noble title, dynasty/nationality,
 * place of origin, office/roleName). Mirrors the Norbert extractor shape so
 * Harvest works even when the plugin is not loaded; plugin extractors may
 * still add more via `extraExtract`.
 */
export function extractPersonWrapperFacts(wrapper: Element): EntityDataAssertion[] {
  const assertions: EntityDataAssertion[] = [];
  const descendants = (name: string) => Array.from(wrapper.getElementsByTagName(name));

  for (const node of descendants('nationality')) {
    const value = node.textContent?.trim();
    if (value) {
      assertions.push({
        element: 'nationality',
        value,
        ref: node.getAttribute('ref') ?? undefined,
      });
    }
  }

  // Norbert uses <placeOfOrigin>; plain TEI sometimes nests <placeName> as origin.
  for (const node of descendants('placeOfOrigin')) {
    const value = node.textContent?.trim();
    if (value) {
      assertions.push({
        element: 'placeName',
        value,
        ref: node.getAttribute('ref') ?? undefined,
      });
    }
  }
  for (const node of Array.from(wrapper.children)) {
    if (node.localName !== 'placeName') continue;
    // Skip placeNames that live under nobleTitle (those are fiefs).
    if (node.parentElement?.localName === 'nobleTitle') continue;
    const value = node.textContent?.trim();
    if (value) {
      assertions.push({
        element: 'placeName',
        value,
        ref: node.getAttribute('ref') ?? undefined,
      });
    }
  }

  for (const node of descendants('officeName')) {
    const value = node.textContent?.trim();
    if (value) {
      assertions.push({
        element: 'state',
        value,
        ref: node.getAttribute('ref') ?? undefined,
      });
    }
  }
  // Bare roleName directly under the wrapper (not inside nobleTitle).
  for (const node of Array.from(wrapper.children)) {
    if (node.localName !== 'roleName') continue;
    const value = node.textContent?.trim();
    if (value) {
      assertions.push({
        element: 'state',
        value,
        ref: node.getAttribute('ref') ?? undefined,
      });
    }
  }

  for (const node of descendants('nobleTitle')) {
    const place = node.getElementsByTagName('placeName')[0];
    const role = node.getElementsByTagName('roleName')[0];
    const posthumous = Array.from(node.getElementsByTagName('persName')).find(
      (person) => person.getAttribute('type') === 'posthumous',
    );
    const value = node.textContent?.trim();
    if (!value) continue;
    assertions.push({
      element: 'nobleTitle',
      value,
      ref: node.getAttribute('ref') ?? undefined,
      children: [
        ...(place
          ? [
              {
                element: 'placeName',
                value: place.textContent?.trim() ?? '',
                ref: place.getAttribute('ref') ?? undefined,
              },
            ]
          : []),
        ...(role
          ? [
              {
                element: 'roleName',
                value: role.textContent?.trim() ?? '',
                ref: role.getAttribute('ref') ?? undefined,
              },
            ]
          : []),
        ...(posthumous
          ? [
              {
                element: 'persName',
                value: posthumous.textContent?.trim() ?? '',
                ref: posthumous.getAttribute('ref') ?? undefined,
              },
            ]
          : []),
      ],
    });
  }

  return assertions;
}

function wrapperEntityId(wrapper: Element): string | null {
  const own = wrapper.getAttribute('key')?.trim();
  if (own) return own;
  const person = Array.from(wrapper.getElementsByTagName('persName')).find((candidate) =>
    candidate.getAttribute('key'),
  );
  return person?.getAttribute('key')?.trim() || null;
}

function personWrapperOccurrence(wrapper: Element): number {
  const document = wrapper.ownerDocument;
  return (
    Array.from(document.getElementsByTagName('name'))
      .filter((candidate) => candidate.getAttribute('type') === 'personWrapper')
      .indexOf(wrapper) + 1
  );
}

export type HarvestedWrapper = {
  entityId: string;
  documentKey: string;
  source: string;
  assertions: EntityDataAssertion[];
};

/** Collect keyed person wrappers and their harvested assertions from one corpus doc. */
export function collectHarvestedWrappers(
  corpusDoc: Document,
  documentKey: string,
  extraExtract?: (wrapper: Element, documentKey: string) => EntityDataAssertion[],
): HarvestedWrapper[] {
  const out: HarvestedWrapper[] = [];
  for (const wrapper of Array.from(corpusDoc.getElementsByTagName('name'))) {
    if (wrapper.getAttribute('type') !== 'personWrapper') continue;
    const entityId = wrapperEntityId(wrapper);
    if (!entityId) continue;
    const occurrence = personWrapperOccurrence(wrapper);
    const source = personWrapperSource(documentKey, occurrence);
    const assertions = [
      ...extractPersonWrapperFacts(wrapper),
      ...(extraExtract ? extraExtract(wrapper, documentKey) : []),
    ];
    // Dedupe by element+value
    const seen = new Set<string>();
    const unique = assertions.filter((assertion) => {
      const key = `${assertion.element}\0${assertion.value.trim()}`;
      if (!assertion.value.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0) continue;
    out.push({ entityId, documentKey, source, assertions: unique });
  }
  return out;
}

const nfc = (text: string) => text.normalize('NFC').trim();

/** Drop assertions the entity already has as active values. */
export function filterNewHarvestAssertions(
  entity: EntitySummary | undefined,
  assertions: EntityDataAssertion[],
): EntityDataAssertion[] {
  if (!entity) return assertions;
  const nationalities = new Set(entity.nationalities.map(nfc));
  const origins = new Set(entity.placesOfOrigin.map(nfc));
  const roles = new Set(entity.roles.map(nfc));
  const titles = new Set(
    entity.nobleTitles.map((title) =>
      nfc([title.fief, title.posthumousName, title.title].filter(Boolean).join('') || title.title),
    ),
  );
  // Also match by concatenated display text used in ingest
  for (const title of entity.nobleTitles) {
    titles.add(nfc([title.fief, title.posthumousName, title.title].filter(Boolean).join('')));
  }

  return assertions.filter((assertion) => {
    const value = nfc(assertion.value);
    if (assertion.element === 'nationality') return !nationalities.has(value);
    if (assertion.element === 'placeName') return !origins.has(value);
    if (assertion.element === 'state' || assertion.element === 'affiliation') {
      return !roles.has(value);
    }
    if (assertion.element === 'nobleTitle') return !titles.has(value);
    return true;
  });
}

export function summarizeHarvestAssertions(assertions: EntityDataAssertion[]): string {
  const parts: string[] = [];
  for (const assertion of assertions) {
    if (assertion.element === 'nationality') parts.push(`dynasty ${assertion.value}`);
    else if (assertion.element === 'placeName') parts.push(`origin ${assertion.value}`);
    else if (assertion.element === 'state' || assertion.element === 'affiliation') {
      parts.push(`role ${assertion.value}`);
    } else if (assertion.element === 'nobleTitle') parts.push(`title ${assertion.value}`);
    else parts.push(`${assertion.element} ${assertion.value}`);
  }
  return parts.join('; ');
}

/**
 * Build review findings: one per wrapper that has at least one fact not yet
 * on the entity. Accept inserts via reconcileXmlExtractedData.
 */
export function findingsFromHarvest(
  wrappers: HarvestedWrapper[],
  entitiesById: Map<string, EntitySummary>,
): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const wrapper of wrappers) {
    const entity = entitiesById.get(wrapper.entityId);
    // A personWrapper is the source syntax, but its key can still be stale or
    // point at a different entity kind. These facts belong only on people;
    // skip unresolved/non-person targets instead of offering an invalid
    // harvest proposal in the database viewer.
    if (!entity || entity.kind !== 'person') continue;
    const novel = filterNewHarvestAssertions(entity, wrapper.assertions);
    if (novel.length === 0) continue;
    findings.push({
      id: `harvest:${wrapper.source}:${wrapper.entityId}`,
      kind: 'harvestWrapper',
      entityId: wrapper.entityId,
      evidence: summarizeHarvestAssertions(novel),
      proposal: {
        action: 'ingestHarvest',
        documentKey: wrapper.documentKey,
        source: wrapper.source,
        assertions: novel,
      },
    });
  }
  return findings;
}
