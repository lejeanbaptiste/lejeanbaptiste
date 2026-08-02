/**
 * SQLite-backed authority refresh/backfill. Same pack + Wikidata enrichment as
 * `backfillEntityNames`, but writes through typed SQLite patches instead of
 * export → DOM mutate → re-import.
 */

import type { AuthorityCandidate } from './authority';
import type { AuthorityPackId } from './packPaths';
import type { AuthorityPackContent } from './packLoader';
import {
  collectGivenFamilyNamesForCandidate,
  collectTypedNamesForCandidate,
  extractWikidataId,
  type DisambiguationCandidate,
  type TypedName,
} from './disambiguationCandidates';
import { mintEntityId, type EntityKind } from './entities';
import type { EntityStore } from './entityStore';
import { normalizeNameType, normalizeTypedNamesForIntake, preferCanonicalFamilyGiven } from './nameTypes';
import {
  authorityEnrichmentForEntity,
  authorityEnrichmentsForEntity,
  buildNorbertNobleTitleIndex,
  buildPackNameIndex,
  buildUniqueOfficeAuthorityByName,
  firstAuthorityEnrichment,
  packTypedNamesForEntity,
  type AuthorityEnrichment,
  type NameBackfillProgress,
  type NameBackfillResult,
  type NorbertNobleTitleCandidate,
} from './nameBackfill';
import { suggestPersonNameSplit, suggestPersonRomanization } from '../plugins/personNameDefaults';
import { autoRomanize } from '../utilities/romanize';
import { norbertAuthorityLookupValues } from './norbertAuthorityId';
import { fetchWikidataLifespan } from './wikidataDates';
import { fetchWikidataNationality } from './wikidataNationality';
import { fetchWikidataPlaceOfBirth } from './wikidataPlaceOfBirth';
import { fetchWikidataPersonWorks } from './wikidataPersonWorks';
import { fetchWikidataWorkDetails } from './wikidataWorkDetails';

type AuthorityRefLookupFn = (request: {
  source: 'cbdb' | 'dila' | 'norbert';
  authorityId: string;
}) => Promise<{
  source?: string;
  authorityId?: string;
  primaryName?: string;
  names?: Array<{ text: string; type?: string; lang?: string }>;
  metadata?: Record<string, unknown>;
} | null>;

const REF_SOURCE_BY_AUTHORITY: Record<string, 'cbdb' | 'dila' | 'norbert'> = {
  CBDB: 'cbdb',
  DILA: 'dila',
  NORBERT: 'norbert',
};

async function referenceEnrichmentsForEntity(
  entity: { authorities: Array<{ type: string; value: string }> },
  lookupAuthorityRef: AuthorityRefLookupFn,
): Promise<Array<{ source: string; enrichment: AuthorityEnrichment }>> {
  const out: Array<{ source: string; enrichment: AuthorityEnrichment }> = [];
  for (const auth of entity.authorities) {
    const sourceKey = REF_SOURCE_BY_AUTHORITY[auth.type.trim().toUpperCase()];
    if (!sourceKey) continue;
    try {
      const hit = await lookupAuthorityRef({
        source: sourceKey,
        authorityId: auth.value,
      });
      if (!hit) continue;
      const names: TypedName[] = [];
      for (const name of hit.names ?? []) {
        const text = name.text?.trim();
        if (!text) continue;
        const type = normalizeNameType(name.type) ?? 'variant';
        if (type === 'primary') continue;
        names.push({ text, type, lang: name.lang });
      }
      out.push({
        source: auth.type.trim().toUpperCase(),
        enrichment: {
          names: normalizeTypedNamesForIntake(names),
          primaryName: hit.primaryName,
          metadata: hit.metadata as AuthorityCandidate['metadata'],
        },
      });
    } catch {
      // Reference tier optional — pack/Wikidata still apply.
    }
  }
  return out;
}

function mergeEnrichmentRows(
  packRows: Array<{ source: string; enrichment: AuthorityEnrichment }>,
  refRows: Array<{ source: string; enrichment: AuthorityEnrichment }>,
): Array<{ source: string; enrichment: AuthorityEnrichment }> {
  const bySource = new Map<string, { source: string; enrichment: AuthorityEnrichment }>();
  for (const row of packRows) bySource.set(row.source, row);
  for (const row of refRows) bySource.set(row.source, row); // reference wins
  return [...bySource.values()];
}

interface PanelPerson {
  id: string;
  kind: string;
  names: Array<{ text: string; nameType?: string | null; language?: string | null }>;
  authorities: Array<{ type: string; value: string }>;
  familyName: string | null;
  givenName: string | null;
}

const isLatnLang = (lang: string | null | undefined): boolean =>
  Boolean(lang && /(^|-)Latn(-|$)/i.test(lang));

function toBackfillEntity(summary: PanelPerson) {
  const nameEntries = summary.names.map((name) => ({
    text: name.text,
    type: name.nameType ?? null,
    lang: name.language ?? null,
  }));
  return {
    id: summary.id,
    kind: summary.kind as EntityKind,
    names: nameEntries.map((entry) => entry.text),
    nameEntries,
    romanized: nameEntries.find((entry) => isLatnLang(entry.lang))?.text ?? null,
    authorities: summary.authorities,
    familyName: summary.familyName,
    givenName: summary.givenName,
  };
}

async function resolveOrCreateByAuthority(
  store: EntityStore,
  kind: 'person' | 'work',
  name: string,
  authorityType: string,
  authorityValue: string,
  extras?: { romanized?: string | null; language?: string | null },
): Promise<string> {
  const existing = await store.sqliteFindByAuthority(kind, authorityType, authorityValue);
  if (existing) {
    await store.sqliteApplyAuthorityBackfillPatch({
      entityId: existing,
      names: [{ text: name, nameType: 'variant', source: authorityType }],
      ...(extras?.romanized
        ? { romanized: { text: extras.romanized, language: extras.language ?? null } }
        : {}),
    });
    return existing;
  }
  const id = mintEntityId(kind);
  await store.sqliteCreatePopulated({
    id,
    kind,
    names: [{ text: name, isPrimary: true, origin: 'authority', source: authorityType }],
    authorities: [{ type: authorityType, value: authorityValue, origin: 'authority', source: authorityType }],
  });
  if (extras?.romanized) {
    await store.sqliteApplyAuthorityBackfillPatch({
      entityId: id,
      romanized: { text: extras.romanized, language: extras.language ?? null },
    });
  }
  return id;
}

/**
 * Enrich linked persons (and Wikidata works) via SQLite authority patches.
 */
export async function backfillEntitiesSqlite(
  store: EntityStore,
  options: {
    entityIds?: string[];
    readPackFile?: (packId: AuthorityPackId) => Promise<AuthorityPackContent>;
    projectLang?: string | null;
    desktopLanguage?: string | null;
    signal?: AbortSignal;
    onProgress?: (p: NameBackfillProgress) => void;
    fetchImpl?: typeof fetch;
    /**
     * When true, expand each Wikidata-linked person into their works (many
     * network round-trips). Default false — the Database Window bulk job skips
     * this; pass true for a deep single-entity refresh.
     */
    expandWikidataWorks?: boolean;
    /**
     * When false, never call live Wikidata for names/dates/nationality/PoB.
     * Default true, but pack data is preferred: live calls are skipped when
     * packs already supply typed names / lifespan / nationality / origins.
     */
    liveWikidata?: boolean;
    /**
     * Optional A6 reference lookup (CBDB/DILA/Norbert sqlite/XML). When present,
     * results take precedence over pack metadata for the same authority id.
     */
    lookupAuthorityRef?: AuthorityRefLookupFn;
    /** Yield between entities so the UI can paint progress (default: microtask). */
    yieldFn?: () => Promise<void>;
  } = {},
): Promise<NameBackfillResult> {
  const {
    entityIds,
    readPackFile,
    projectLang,
    desktopLanguage,
    signal,
    onProgress,
    fetchImpl,
    expandWikidataWorks = false,
    liveWikidata = true,
    lookupAuthorityRef,
    yieldFn = () => new Promise((resolve) => setTimeout(resolve, 0)),
  } = options;

  const personSummaries = ((await store.sqlitePanelSummaries('person')) ?? []) as PanelPerson[];
  const workSummaries = ((await store.sqlitePanelSummaries('work')) ?? []) as PanelPerson[];
  const idFilter = entityIds ? new Set(entityIds) : null;

  const targets = personSummaries
    .map(toBackfillEntity)
    .filter((entity) => entity.authorities.length > 0 && (!idFilter || idFilter.has(entity.id)));
  const workTargets = workSummaries
    .map(toBackfillEntity)
    .filter(
      (entity) =>
        entity.authorities.some((auth) => auth.type.trim().toUpperCase() === 'WIKIDATA') &&
        (!idFilter || idFilter.has(entity.id)),
    );
  const totalTargets = targets.length + workTargets.length;

  const skippedNoAuthority = idFilter
    ? entityIds!.filter((id) => {
        const entity = personSummaries.find((row) => row.id === id);
        return !entity || entity.authorities.length === 0;
      }).length
    : personSummaries.filter((entity) => entity.authorities.length === 0).length;

  const packIndex = readPackFile ? await buildPackNameIndex(readPackFile) : null;
  const nobleTitleIndex = readPackFile ? await buildNorbertNobleTitleIndex(readPackFile) : null;
  const officeAuthorityByName = readPackFile
    ? await buildUniqueOfficeAuthorityByName(readPackFile)
    : null;

  let entitiesScanned = 0;
  let entitiesUpdated = 0;
  let namesAdded = 0;
  let cancelled = false;

  // Attach missing NORBERT/CBDB idnos to offices that uniquely match a pack
  // primary name. Homonyms are skipped. This closes the historical gap where
  // offices were minted locally without authority links.
  if (officeAuthorityByName && (!idFilter || entityIds?.some((id) => id.startsWith('office-')))) {
    try {
      const officeSummaries = ((await store.sqlitePanelSummaries('office')) ?? []) as PanelPerson[];
      for (const summary of officeSummaries) {
        if (signal?.aborted) {
          cancelled = true;
          break;
        }
        if (idFilter && !idFilter.has(summary.id)) continue;
        const primary =
          summary.names.find((name) => name.nameType === 'primary')?.text?.normalize('NFC').trim() ||
          summary.names[0]?.text?.normalize('NFC').trim();
        if (!primary) continue;
        const candidates = officeAuthorityByName.get(primary);
        if (!candidates?.length) continue;
        entitiesScanned++;
        let attached = false;
        for (const hit of candidates) {
          const already = summary.authorities.some(
            (auth) =>
              auth.type.trim().toUpperCase() === hit.type && auth.value.trim() === hit.value,
          );
          if (already) continue;
          const claimed = await store.sqliteFindByAuthority('office', hit.type, hit.value);
          if (claimed && claimed !== summary.id) continue;
          const ok = await store.sqliteAttachAuthority(summary.id, hit.type, hit.value);
          if (ok) attached = true;
        }
        if (attached) entitiesUpdated++;
        onProgress?.({
          done: entitiesScanned,
          total: totalTargets + officeSummaries.length,
          entityId: summary.id,
          entityLabel: primary,
        });
      }
    } catch {
      // Attach/panel APIs unavailable — skip office idno backfill silently.
    }
  }

  for (const entity of targets) {
    if (signal?.aborted || cancelled) {
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
    const namePatches: Array<{
      text: string;
      nameType?: string | null;
      language?: string | null;
      source?: string | null;
    }> = [];

    if (primaryName && primaryName !== entity.names[0]) {
      namePatches.push({
        text: primaryName,
        nameType: 'variant',
        source: entity.authorities[0]?.type,
      });
    }

    candidate.startYear = metadata?.startYear;
    candidate.endYear = metadata?.endYear;
    candidate.authorityMetadata = metadata;

    const packTypedNames = candidate.typedNames ?? [];
    const refRows = lookupAuthorityRef
      ? await referenceEnrichmentsForEntity(entity, lookupAuthorityRef)
      : [];
    const refTypedNames = refRows.flatMap((row) => row.enrichment.names ?? []);
    const mergedTypedNames = refTypedNames.length > 0 ? refTypedNames : packTypedNames;
    const packHasTypedNames = mergedTypedNames.length > 0;
    const packHasFamily = mergedTypedNames.some((name) => name.type === 'family');
    const packHasGiven = mergedTypedNames.some((name) => name.type === 'given');

    const givenFamily =
      liveWikidata && !(entity.familyName && entity.givenName) && !(packHasFamily && packHasGiven)
        ? await collectGivenFamilyNamesForCandidate(candidate, projectLang, fetchImpl)
        : {};
    const familyNames = [
      ...(givenFamily.familyName ? [givenFamily.familyName] : []),
      ...(entity.familyName ? [entity.familyName] : []),
      ...mergedTypedNames.filter((name) => name.type === 'family').map((name) => name.text),
    ];
    // Prefer reference/pack typed names when present; only hit Wikidata when empty.
    const typedNames = normalizeTypedNamesForIntake(
      packHasTypedNames || !liveWikidata
        ? mergedTypedNames
        : await collectTypedNamesForCandidate(candidate, fetchImpl),
      familyNames,
    );
    for (const typed of typedNames) {
      namePatches.push({
        text: typed.text,
        nameType: typed.type,
        language: typed.lang,
        source: entity.authorities[0]?.type,
      });
    }

    const preferred = preferCanonicalFamilyGiven(
      primaryName || entity.names[0] || null,
      typedNames,
    );
    let familyName = !entity.familyName
      ? givenFamily.familyName ||
        preferred.familyName ||
        suggestPersonNameSplit(entity.names[0] ?? '', projectLang ?? null)?.familyName ||
        null
      : null;
    let givenName = !entity.givenName
      ? givenFamily.givenName ||
        preferred.givenName ||
        suggestPersonNameSplit(entity.names[0] ?? '', projectLang ?? null)?.givenName ||
        null
      : null;

    // When the entity already has a 姓/名 that is merely one of several pack
    // variants (e.g. 元 instead of 拓拔 for 拓拔建), still propose the preferred
    // pair so the scalar fields can be corrected on re-backfill.
    if (entity.familyName && preferred.familyName && entity.familyName !== preferred.familyName) {
      const packFamilies = new Set(
        typedNames.filter((name) => name.type === 'family').map((name) => name.text),
      );
      if (packFamilies.has(entity.familyName)) familyName = preferred.familyName;
    }
    if (entity.givenName && preferred.givenName && entity.givenName !== preferred.givenName) {
      const packGivens = new Set(
        typedNames.filter((name) => name.type === 'given').map((name) => name.text),
      );
      if (packGivens.has(entity.givenName)) givenName = preferred.givenName;
    }

    let romanized: { text: string; language?: string | null } | null = null;
    if (!entity.romanized) {
      const authorityRomanized = metadata?.pinyin ?? metadata?.yomi;
      const familyRom =
        preferred.familyName &&
        autoRomanize(preferred.familyName, projectLang ?? null, { concatenate: true });
      const givenRom =
        preferred.givenName &&
        autoRomanize(preferred.givenName, projectLang ?? null, { concatenate: true });
      const fromParts = familyRom && givenRom ? `${familyRom} ${givenRom}` : '';
      const text =
        authorityRomanized?.trim() ||
        fromParts ||
        suggestPersonRomanization(entity.names[0] ?? '', projectLang ?? null);
      if (text) romanized = { text, language: projectLang ?? null };
    }

    const dates: Array<{ source: string; startYear?: number | null; endYear?: number | null }> = [];
    const nationalities: Array<{ label: string; ref?: string | null; source: string }> = [];
    const origins: Array<{
      label: string;
      ref?: string | null;
      source: string;
      nameType?: string | null;
    }> = [];
    const offices: Array<{ label: string; ref?: string | null; source: string }> = [];
    const authorityCaches: Array<{
      authorityType: string;
      source?: string | null;
      payload: unknown;
    }> = [];

    for (const { source, enrichment } of mergeEnrichmentRows(
      authorityEnrichmentsForEntity(entity, packIndex),
      refRows,
    )) {
      const meta = enrichment.metadata;
      if (!meta) continue;
      const normalizedSource = source.trim().toUpperCase();
      if (meta.startYear != null || meta.endYear != null) {
        dates.push({
          source: normalizedSource,
          startYear: meta.startYear,
          endYear: meta.endYear,
        });
      }
      for (const value of meta.nationality ?? []) {
        nationalities.push({
          label: value.label,
          ref: value.canonicalId,
          source: normalizedSource,
        });
      }
      for (const value of meta.origin ?? []) {
        if (!value.placeName?.trim()) continue;
        origins.push({
          label: value.placeName,
          ref: value.placeAuthorityId,
          source: value.source ?? normalizedSource,
          nameType: value.originType,
        });
      }
      if (meta.appointments?.length) {
        authorityCaches.push({
          authorityType: normalizedSource,
          source: normalizedSource,
          payload: meta,
        });
        for (const appointment of meta.appointments) {
          if (!appointment.office?.name?.trim()) continue;
          offices.push({
            label: appointment.office.name,
            ref: appointment.office.authorityId,
            source: appointment.source ?? normalizedSource,
          });
        }
      }
    }

    const nobleTitles: Array<{
      placeName: string;
      roleName: string;
      posthumousName?: string | null;
      dynasty?: string | null;
      ref?: string | null;
      source: string;
    }> = [];
    const norbertIdno = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'NORBERT',
    );
    if (norbertIdno && nobleTitleIndex) {
      let titles: ReturnType<typeof nobleTitleIndex.get> = undefined;
      for (const key of norbertAuthorityLookupValues(norbertIdno.value)) {
        titles = nobleTitleIndex.get(key);
        if (titles?.length) break;
      }
      for (const title of titles ?? []) {
        nobleTitles.push({
          placeName: title.placeName,
          roleName: title.roleName,
          posthumousName: title.posthumousName,
          dynasty: title.dynasty,
          ref: title.ref,
          source: `Norbert:${title.ref}`,
        });
      }
    }
    for (const row of refRows) {
      const titles = (row.enrichment.metadata as {
        nobleTitles?: Array<{
          fief?: string;
          rank?: string;
          posthumous?: string;
          dynasty?: string;
          id?: string;
        }>;
      } | undefined)?.nobleTitles;
      for (const title of titles ?? []) {
        if (!title.fief && !title.rank) continue;
        nobleTitles.push({
          placeName: title.fief ?? '',
          roleName: title.rank ?? '',
          posthumousName: title.posthumous,
          dynasty: title.dynasty,
          ref: title.id ? `NORBERT:person_nt:${title.id}` : null,
          source: 'NORBERT',
        });
      }
    }

    const wikidataIdno = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'WIKIDATA',
    );
    if (wikidataIdno && liveWikidata) {
      const needDates = dates.length === 0;
      const needNationality = nationalities.length === 0;
      const needOrigin = origins.length === 0;
      if (needDates || needNationality || needOrigin) {
        const [lifespan, nationality, placeOfBirth] = await Promise.all([
          needDates
            ? fetchWikidataLifespan(wikidataIdno.value, fetchImpl).catch(() => null)
            : Promise.resolve(null),
          needNationality
            ? fetchWikidataNationality(wikidataIdno.value, fetchImpl, projectLang).catch(() => null)
            : Promise.resolve(null),
          needOrigin
            ? fetchWikidataPlaceOfBirth(wikidataIdno.value, fetchImpl, projectLang).catch(
                () => null,
              )
            : Promise.resolve(null),
        ]);
        if (lifespan?.birthYear != null || lifespan?.deathYear != null) {
          dates.push({
            source: 'WIKIDATA',
            startYear: lifespan?.birthYear,
            endYear: lifespan?.deathYear,
          });
        }
        for (const value of nationality ?? []) {
          nationalities.push({
            label: value.label,
            ref: value.canonicalId,
            source: 'WIKIDATA',
          });
        }
        for (const value of placeOfBirth ?? []) {
          origins.push({
            label: value.label,
            ref: value.canonicalId,
            source: 'WIKIDATA',
          });
        }
      }

      if (expandWikidataWorks) {
        const qid = extractWikidataId(wikidataIdno.value) ?? wikidataIdno.value;
        const personWorks = await fetchWikidataPersonWorks(qid, fetchImpl, projectLang).catch(
          () => [],
        );
        for (const work of personWorks) {
          const workId = await resolveOrCreateByAuthority(
            store,
            'work',
            work.label,
            'Wikidata',
            work.qid,
          );
          const workDetails = await fetchWikidataWorkDetails(
            work.qid,
            fetchImpl,
            desktopLanguage,
          ).catch(() => null);
          const workPatchNames =
            workDetails?.titles.map((title) => ({
              text: title.label,
              nameType: 'translation',
              language: title.language,
              source: 'Wikidata',
            })) ?? [];
          const workResult = await store.sqliteApplyAuthorityBackfillPatch({
            entityId: workId,
            names: workPatchNames,
            workAuthors: [
              {
                name: entity.names[0] ?? entity.id,
                personId: entity.id,
                ref: `#${entity.id}`,
                source: 'Wikidata',
              },
            ],
            workDate:
              workDetails?.publicationYear != null
                ? { source: 'WIKIDATA', startYear: workDetails.publicationYear, endYear: null }
                : null,
          });
          if (workResult.changed) entityChanged = true;
        }
      }
    }

    const result = await store.sqliteApplyAuthorityBackfillPatch({
      entityId: entity.id,
      names: namePatches,
      familyName,
      givenName,
      romanized,
      dates,
      nationalities,
      origins,
      offices,
      nobleTitles,
      authorityCaches,
    });
    if (result.changed) entityChanged = true;
    addedThisEntity += result.namesAdded;
    if (entityChanged) entitiesUpdated++;
    namesAdded += addedThisEntity;

    onProgress?.({
      done: entitiesScanned,
      total: totalTargets,
      entityId: entity.id,
      entityLabel: entity.names[0],
      addedNames: addedThisEntity,
    });
    await yieldFn();
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
      const details = await fetchWikidataWorkDetails(qid, fetchImpl, desktopLanguage).catch(
        () => null,
      );
      if (details) {
        const authorIds: Array<{ name: string; personId: string }> = [];
        for (const author of details.authors) {
          const personId = await resolveOrCreateByAuthority(
            store,
            'person',
            author.label,
            'Wikidata',
            author.qid,
            {
              romanized: autoRomanize(author.label, projectLang ?? null),
              language: projectLang ?? null,
            },
          );
          authorIds.push({ name: author.label, personId });
        }
        const result = await store.sqliteApplyAuthorityBackfillPatch({
          entityId: entity.id,
          names: details.titles.map((title) => ({
            text: title.label,
            nameType: 'translation',
            language: title.language,
            source: 'Wikidata',
          })),
          workAuthors: authorIds.map((author) => ({
            name: author.name,
            personId: author.personId,
            ref: `#${author.personId}`,
            source: 'Wikidata',
          })),
          workDate:
            details.publicationYear != null
              ? { source: 'WIKIDATA', startYear: details.publicationYear, endYear: null }
              : null,
        });
        enriched = result.changed;
      }
    }
    if (enriched) entitiesUpdated++;
    onProgress?.({
      done: entitiesScanned,
      total: totalTargets,
      entityId: entity.id,
      entityLabel: entity.names[0],
    });
    await yieldFn();
  }

  return {
    entitiesScanned,
    entitiesUpdated,
    namesAdded,
    skippedNoAuthority,
    cancelled,
  };
}
