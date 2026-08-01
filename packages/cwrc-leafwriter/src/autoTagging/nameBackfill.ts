/**
 * Non-destructive enrichment of person entities with typed names from authority
 * packs (CBDB/DILA `names[]`) and live Wikidata claims. Reuses the same
 * collectors as link-time disambiguation; the caller persists the document.
 */

import type { AuthorityPackId } from './packPaths';
import { iterateAuthorityNdjson, type AuthorityPackContent } from './packLoader';
import {
  collectGivenFamilyNamesForCandidate,
  collectTypedNamesForCandidate,
  type DisambiguationCandidate,
  type TypedName,
} from './disambiguationCandidates';
import {
  addEntityName,
  getFamilyName,
  getGivenName,
  listEntities,
  setFamilyName,
  setGivenName,
  setRomanizedName,
  type EntitySummary,
} from './entityOps';
import {
  appendAuthorityDates,
  appendAuthorityNobleTitles,
  appendAuthoritySourcedValues,
  findEntity,
  setAuthorityCache,
  touchEntity,
} from './entities';
import type { AuthorityCandidate } from './authority';
import { isFamilyPrefixedCourtesyName, normalizeNameType, type NameTypeId } from './nameTypes';
import { suggestPersonNameSplit, suggestPersonRomanization } from '../plugins/personNameDefaults';
import { fetchWikidataLifespan } from './wikidataDates';
import { fetchWikidataNationality } from './wikidataNationality';
import { fetchWikidataPlaceOfBirth } from './wikidataPlaceOfBirth';
import { enrichWikidataWorkEntity } from './wikidataWorkDetails';
import { extractWikidataId } from './disambiguationCandidates';
import { enrichWikidataPersonWorks } from './wikidataPersonWorks';

export interface NameBackfillProgress {
  done: number;
  total: number;
  entityId?: string;
  entityLabel?: string;
  addedNames?: number;
}

export interface NameBackfillResult {
  entitiesScanned: number;
  entitiesUpdated: number;
  namesAdded: number;
  skippedNoAuthority: number;
  cancelled: boolean;
}

/** Same filter as link-time pack ingestion: skip primary (already the headword). */
function typedNamesFromPackRow(
  names: { text: string; type?: string; lang?: string }[] | undefined,
): TypedName[] {
  if (!names?.length) return [];
  const familyNames = names
    .filter((name) => normalizeNameType(name.type) === 'family')
    .map((name) => name.text?.trim())
    .filter((text): text is string => Boolean(text));
  const out: TypedName[] = [];
  for (const name of names) {
    const text = name.text?.trim();
    if (!text) continue;
    const type = normalizeNameType(name.type) ?? 'variant';
    if (type === 'primary') continue;
    if (type === 'courtesy' && isFamilyPrefixedCourtesyName(text, familyNames)) continue;
    out.push({ text, type, lang: name.lang });
  }
  return out;
}

export interface AuthorityEnrichment {
  names: TypedName[];
  primaryName?: string;
  metadata?: AuthorityCandidate['metadata'];
}

export interface NorbertNobleTitleCandidate {
  placeName: string;
  roleName: string;
  posthumousName?: string;
  dynasty?: string;
  /** The wiki-nt-links record's own authorityId, e.g. "wiki-nt:1610". */
  ref: string;
}

/** Norbert's `person_nt` table is canonical: every title it records for a
 * person should be backfillable regardless of whether a zh.wikipedia
 * noble-title list page happens to cover it (most emperors/founders never
 * are — see `norbert-direct` records in the compiled asset). Keyed by the
 * person's Norbert authority id (`metadata.crosswalk.norbert`).
 */
export async function buildNorbertNobleTitleIndex(
  readPackFile: (packId: AuthorityPackId) => Promise<AuthorityPackContent>,
): Promise<Map<string, NorbertNobleTitleCandidate[]>> {
  const index = new Map<string, NorbertNobleTitleCandidate[]>();
  try {
    const content = await readPackFile('norbert-wiki-nt');
    for (const row of iterateAuthorityNdjson(content)) {
      const personId = row.metadata?.crosswalk?.norbert;
      const title = row.metadata?.nobleTitle;
      if (!personId || !title || (!title.fief && !title.roleName)) continue;
      const list = index.get(personId) ?? [];
      list.push({
        placeName: title.fief ?? '',
        roleName: title.roleName ?? '',
        posthumousName: title.posthumousName,
        dynasty: row.metadata?.dynasty,
        ref: row.authorityId,
      });
      index.set(personId, list);
    }
  } catch {
    // Pack missing or unreadable — skip silently, matching buildPackNameIndex.
  }
  return index;
}

/** Appends Norbert-canonical noble titles linked to an entity's Norbert authority id. */
function applyNorbertNobleTitles(
  doc: Document,
  entityId: string,
  titles: NorbertNobleTitleCandidate[],
): boolean {
  const item = findEntity(doc, entityId);
  if (!item) return false;
  return appendAuthorityNobleTitles(
    doc,
    item,
    titles.map((title) => ({
      placeName: title.placeName,
      roleName: title.roleName,
      posthumousName: title.posthumousName,
      dynasty: title.dynasty,
      ref: title.ref,
      source: `Norbert:${title.ref}`,
    })),
  );
}

export async function buildPackNameIndex(
  readPackFile: (packId: AuthorityPackId) => Promise<AuthorityPackContent>,
): Promise<Map<string, AuthorityEnrichment>> {
  const index = new Map<string, AuthorityEnrichment>();
  const packs: { packId: AuthorityPackId; source: string }[] = [
    { packId: 'cbdb-persons', source: 'CBDB' },
    { packId: 'dila-persons', source: 'DILA' },
    // Norbert's persons pack carries names, dates, nationality, and
    // place-of-origin assertions alongside CBDB/DILA-style metadata.
    { packId: 'norbert-persons', source: 'NORBERT' },
  ];
  for (const { packId, source } of packs) {
    try {
      const content = await readPackFile(packId);
      for (const row of iterateAuthorityNdjson(content)) {
        const typed = typedNamesFromPackRow(row.names);
        if (typed.length === 0 && !row.metadata) continue;
        index.set(`${source}:${row.authorityId}`, {
          names: typed,
          primaryName: row.primaryName,
          metadata: row.metadata,
        });
      }
    } catch {
      // Pack missing or unreadable — skip silently.
    }
  }
  return index;
}

export function packTypedNamesForEntity(
  entity: Pick<EntitySummary, 'authorities'>,
  index: Map<string, AuthorityEnrichment> | null,
): TypedName[] {
  if (!index) return [];
  const byText = new Map<string, TypedName>();
  for (const auth of entity.authorities) {
    // Normalize casing to match buildPackNameIndex's keys (and
    // authorityEnrichmentsForEntity's lookup below) — idno @type casing
    // varies by source (e.g. "Norbert" vs "CBDB"/"DILA").
    const key = `${auth.type.trim().toUpperCase()}:${auth.value.trim()}`;
    const enrichment = index.get(key);
    if (!enrichment) continue;
    for (const name of enrichment.names) {
      byText.set(name.text.normalize('NFC'), name);
    }
  }
  return [...byText.values()];
}

export function authorityEnrichmentForEntity(
  entity: Pick<EntitySummary, 'authorities'>,
  index: Map<string, AuthorityEnrichment> | null,
): AuthorityCandidate['metadata'] | undefined {
  if (!index) return undefined;
  const rows = authorityEnrichmentsForEntity(entity, index)
    .map(({ enrichment }) => enrichment.metadata)
    .filter((metadata): metadata is NonNullable<AuthorityCandidate['metadata']> =>
      Boolean(metadata),
    );
  if (rows.length === 0) return undefined;
  return {
    ...rows[0],
    startYear: rows.find((row) => row.startYear != null)?.startYear,
    endYear: rows.find((row) => row.endYear != null)?.endYear,
    nationality: [
      ...new Map(
        rows.flatMap((row) => row.nationality ?? []).map((value) => [value.canonicalId, value]),
      ).values(),
    ],
    origin: [
      ...new Map(
        rows
          .flatMap((row) => row.origin ?? [])
          .map((value) => [`${value.source}:${value.placeAuthorityId ?? value.placeName}`, value]),
      ).values(),
    ],
    appointments: [
      ...new Map(
        rows
          .flatMap((row) => row.appointments ?? [])
          .map((value) => [`${value.source}:${value.authorityId}`, value]),
      ).values(),
    ],
  };
}

/** Return every pack enrichment linked to an entity, retaining its source. */
export function authorityEnrichmentsForEntity(
  entity: Pick<EntitySummary, 'authorities'>,
  index: Map<string, AuthorityEnrichment> | null,
): Array<{ source: string; enrichment: AuthorityEnrichment }> {
  if (!index) return [];
  return entity.authorities.flatMap((auth) => {
    const source = auth.type.trim().toUpperCase();
    const enrichment = index.get(`${source}:${auth.value.trim()}`);
    return enrichment ? [{ source, enrichment }] : [];
  });
}

export function firstAuthorityEnrichment(
  entity: Pick<EntitySummary, 'authorities'>,
  index: Map<string, AuthorityEnrichment> | null,
): AuthorityEnrichment | undefined {
  return authorityEnrichmentsForEntity(entity, index)[0]?.enrichment;
}

/** Apply the same scalar/repeatable authority fields written when disambiguating. */
function applyAuthorityMetadata(
  doc: Document,
  entityId: string,
  metadata: AuthorityCandidate['metadata'] | undefined,
  source: string,
): boolean {
  if (!metadata) return false;
  const item = findEntity(doc, entityId);
  if (!item) return false;
  const normalizedSource = source.trim().toUpperCase();
  let changed = appendAuthorityDates(doc, item, source, {
    startYear: metadata.startYear,
    endYear: metadata.endYear,
  });
  if (metadata.nationality?.length) {
    const nationalityChanged = appendAuthoritySourcedValues(
      doc,
      item,
      'nationality',
      metadata.nationality.map((value) => ({
        text: value.label,
        ref: value.canonicalId,
        source: normalizedSource,
      })),
    );
    changed = changed || nationalityChanged;
  }
  if (metadata.origin?.length) {
    const originChanged = appendAuthoritySourcedValues(
      doc,
      item,
      'placeName',
      metadata.origin
        .filter((value) => value.placeName?.trim())
        .map((value) => ({
          text: value.placeName,
          ref: value.placeAuthorityId,
          source: value.source ?? normalizedSource,
          type: value.originType,
        })),
    );
    changed = changed || originChanged;
  }
  if (metadata.appointments?.length) {
    const sourceNote = Array.from(item.children).find(
      (child) =>
        child.localName === 'note' &&
        child.getAttribute('type') === 'authority-cache' &&
        child.getAttribute('source') === source.trim().toUpperCase(),
    );
    const previous = sourceNote?.textContent ?? '';
    const next = JSON.stringify(metadata);
    if (previous !== next) {
      setAuthorityCache(doc, entityId, source.trim().toUpperCase(), metadata);
      changed = true;
    }
    const rolesChanged = appendAuthoritySourcedValues(
      doc,
      item,
      'affiliation',
      metadata.appointments
        .filter((appointment) => appointment.office?.name?.trim())
        .map((appointment) => ({
          text: appointment.office.name,
          ref: appointment.office.authorityId,
          source: appointment.source ?? normalizedSource,
        })),
    );
    changed = changed || rolesChanged;
  }
  if (changed) touchEntity(item);
  return changed;
}

function nameTypeForText(
  doc: Document,
  entityId: string,
  text: string,
): NameTypeId | null | undefined {
  return listEntities(doc)
    .find((entity) => entity.id === entityId)
    ?.nameEntries.find((entry) => entry.text === text)?.type;
}

/**
 * Apply one typed name non-destructively. Returns true when a new name was added
 * or an existing untyped name was upgraded with `@type`.
 */
function applyTypedName(
  doc: Document,
  entityId: string,
  typed: TypedName,
  source?: string,
): boolean {
  const beforeType = nameTypeForText(doc, entityId, typed.text);
  const added = addEntityName(doc, entityId, typed.text, {
    type: typed.type,
    lang: typed.lang,
    origin: 'authority',
    source,
  });
  if (added) return true;
  if (beforeType == null) {
    const afterType = nameTypeForText(doc, entityId, typed.text);
    return afterType === typed.type;
  }
  return false;
}

/**
 * Enrich persons with typed names from packs + Wikidata.
 * @param entityIds if provided, only those ids; else all persons with authorities
 */
export async function backfillEntityNames(
  doc: Document,
  options: {
    entityIds?: string[];
    readPackFile?: (packId: AuthorityPackId) => Promise<AuthorityPackContent>;
    projectLang?: string | null;
    desktopLanguage?: string | null;
    signal?: AbortSignal;
    onProgress?: (p: NameBackfillProgress) => void;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<NameBackfillResult> {
  const { entityIds, readPackFile, projectLang, desktopLanguage, signal, onProgress, fetchImpl } =
    options;

  const allPersons = listEntities(doc).filter((entity) => entity.kind === 'person');
  const idFilter = entityIds ? new Set(entityIds) : null;
  const targets = allPersons.filter(
    (entity) => entity.authorities.length > 0 && (!idFilter || idFilter.has(entity.id)),
  );
  const workTargets = listEntities(doc).filter(
    (entity) =>
      entity.kind === 'work' &&
      entity.authorities.some((auth) => auth.type.trim().toUpperCase() === 'WIKIDATA') &&
      (!idFilter || idFilter.has(entity.id)),
  );
  const totalTargets = targets.length + workTargets.length;

  const skippedNoAuthority = idFilter
    ? entityIds!.filter((id) => {
        const entity = allPersons.find((row) => row.id === id);
        return !entity || entity.authorities.length === 0;
      }).length
    : allPersons.filter((entity) => entity.authorities.length === 0).length;

  const packIndex = readPackFile ? await buildPackNameIndex(readPackFile) : null;
  const nobleTitleIndex = readPackFile ? await buildNorbertNobleTitleIndex(readPackFile) : null;

  let entitiesScanned = 0;
  let entitiesUpdated = 0;
  let namesAdded = 0;
  let cancelled = false;

  for (const entity of targets) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    entitiesScanned++;
    let addedThisEntity = 0;
    let entityChanged = false;

    const candidate: DisambiguationCandidate = {
      id: entity.id,
      label: entity.names[0] ?? entity.id,
      sources: entity.authorities.map((auth) => auth.type),
      uri: '',
      authorityIds: entity.authorities,
      localEntityId: entity.id,
      typedNames: (() => {
        const fromPack = packTypedNamesForEntity(entity, packIndex);
        return fromPack.length > 0 ? fromPack : undefined;
      })(),
    };
    const metadata = authorityEnrichmentForEntity(entity, packIndex);
    const firstEnrichment = firstAuthorityEnrichment(entity, packIndex);
    const primaryName = firstEnrichment?.primaryName?.trim();
    if (primaryName && primaryName !== entity.names[0]) {
      if (
        applyTypedName(
          doc,
          entity.id,
          { text: primaryName, type: 'variant' },
          entity.authorities[0]?.type,
        )
      ) {
        namesAdded++;
        entityChanged = true;
      }
    }
    candidate.startYear = metadata?.startYear;
    candidate.endYear = metadata?.endYear;
    candidate.authorityMetadata = metadata;

    const givenFamily = await collectGivenFamilyNamesForCandidate(
      candidate,
      projectLang,
      fetchImpl,
    );
    const familyNames = [
      ...(givenFamily.familyName ? [givenFamily.familyName] : []),
      ...(getFamilyName(doc, entity.id) ? [getFamilyName(doc, entity.id)!] : []),
      ...(candidate.typedNames ?? [])
        .filter((name) => name.type === 'family')
        .map((name) => name.text),
    ];
    const typedNames = (await collectTypedNamesForCandidate(candidate, fetchImpl)).filter(
      (name) => name.type !== 'courtesy' || !isFamilyPrefixedCourtesyName(name.text, familyNames),
    );

    for (const typed of typedNames) {
      if (applyTypedName(doc, entity.id, typed, entity.authorities[0]?.type)) {
        addedThisEntity++;
        entityChanged = true;
      }
      if (typed.type === 'family' && !getFamilyName(doc, entity.id)) {
        setFamilyName(doc, entity.id, typed.text);
        entityChanged = true;
      }
      if (typed.type === 'given' && !getGivenName(doc, entity.id)) {
        setGivenName(doc, entity.id, typed.text);
        entityChanged = true;
      }
    }

    if (givenFamily.familyName && !getFamilyName(doc, entity.id)) {
      setFamilyName(doc, entity.id, givenFamily.familyName);
      entityChanged = true;
    }
    if (givenFamily.givenName && !getGivenName(doc, entity.id)) {
      setGivenName(doc, entity.id, givenFamily.givenName);
      entityChanged = true;
    }

    // Norbert supplies the historically appropriate surname boundary when its
    // plugin is active; use it only as a fallback after authority values.
    const norbertSplit = suggestPersonNameSplit(entity.names[0] ?? '', projectLang ?? null);
    if (norbertSplit?.familyName && !getFamilyName(doc, entity.id)) {
      setFamilyName(doc, entity.id, norbertSplit.familyName);
      entityChanged = true;
    }
    if (norbertSplit?.givenName && !getGivenName(doc, entity.id)) {
      setGivenName(doc, entity.id, norbertSplit.givenName);
      entityChanged = true;
    }
    if (!entity.romanized) {
      const authorityRomanized = metadata?.pinyin ?? metadata?.yomi;
      const romanized =
        authorityRomanized?.trim() ||
        suggestPersonRomanization(entity.names[0] ?? '', projectLang ?? null);
      if (romanized) {
        setRomanizedName(doc, entity.id, romanized, projectLang ?? null);
        entityChanged = true;
      }
    }

    // Refresh every linked authority independently. Dates are stored as
    // source-specific assertions, so a DILA value is retained even when a
    // user value or another authority already supplied a different year.
    for (const { source, enrichment } of authorityEnrichmentsForEntity(entity, packIndex)) {
      if (applyAuthorityMetadata(doc, entity.id, enrichment.metadata, source)) {
        entityChanged = true;
      }
    }

    const norbertIdno = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'NORBERT',
    );
    if (norbertIdno && nobleTitleIndex) {
      const titles = nobleTitleIndex.get(norbertIdno.value.trim());
      if (titles?.length && applyNorbertNobleTitles(doc, entity.id, titles)) {
        entityChanged = true;
      }
    }

    // Packs only cover CBDB/DILA; a Wikidata-linked entity needs its own
    // live fetch so refresh isn't a no-op for it.
    const wikidataIdno = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'WIKIDATA',
    );
    if (wikidataIdno) {
      const [lifespan, nationality, placeOfBirth] = await Promise.all([
        fetchWikidataLifespan(wikidataIdno.value, fetchImpl).catch(() => null),
        fetchWikidataNationality(wikidataIdno.value, fetchImpl, projectLang).catch(() => null),
        fetchWikidataPlaceOfBirth(wikidataIdno.value, fetchImpl, projectLang).catch(() => null),
      ]);
      if (lifespan || nationality || placeOfBirth) {
        const changed = applyAuthorityMetadata(
          doc,
          entity.id,
          {
            startYear: lifespan?.birthYear,
            endYear: lifespan?.deathYear,
            nationality: nationality?.map((value) => ({
              id: value.canonicalId,
              canonicalId: value.canonicalId,
              label: value.label,
            })),
            origin: placeOfBirth?.map((value) => ({
              placeName: value.label,
              placeAuthorityId: value.canonicalId,
              source: 'Wikidata',
            })),
          },
          'Wikidata',
        );
        if (changed) entityChanged = true;
      }
      const personWorks = await enrichWikidataPersonWorks(
        doc,
        entity.id,
        extractWikidataId(wikidataIdno.value) ?? wikidataIdno.value,
        projectLang,
        desktopLanguage,
        fetchImpl,
      ).catch(() => null);
      if (personWorks?.authorsAdded) entityChanged = true;
    }

    if (entityChanged) entitiesUpdated++;
    namesAdded += addedThisEntity;

    onProgress?.({
      done: entitiesScanned,
      total: totalTargets,
      entityId: entity.id,
      entityLabel: entity.names[0],
      addedNames: addedThisEntity,
    });
  }

  for (const entity of workTargets) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }
    entitiesScanned++;
    const wikidata = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'WIKIDATA',
    );
    const qid = extractWikidataId(wikidata?.value ?? '');
    let enriched = false;
    if (qid) {
      enriched = Boolean(
        await enrichWikidataWorkEntity(
          doc,
          entity.id,
          qid,
          projectLang,
          desktopLanguage,
          fetchImpl,
        ).catch(() => null),
      );
    }
    if (enriched) entitiesUpdated++;
    onProgress?.({
      done: entitiesScanned,
      total: totalTargets,
      entityId: entity.id,
      entityLabel: entity.names[0],
    });
  }

  return {
    entitiesScanned,
    entitiesUpdated,
    namesAdded,
    skippedNoAuthority,
    cancelled,
  };
}
