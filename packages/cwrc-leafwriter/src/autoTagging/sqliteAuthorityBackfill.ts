/**
 * SQLite-backed authority refresh/backfill. Same pack + Wikidata enrichment as
 * `backfillEntityNames`, but writes through typed SQLite patches instead of
 * export → DOM mutate → re-import.
 */

import type { AuthorityPackId } from './packPaths';
import type { AuthorityPackContent } from './packLoader';
import {
  collectGivenFamilyNamesForCandidate,
  collectTypedNamesForCandidate,
  extractWikidataId,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import { mintEntityId, type EntityKind } from './entities';
import type { EntityStore } from './entityStore';
import { isFamilyPrefixedCourtesyName } from './nameTypes';
import {
  authorityEnrichmentForEntity,
  authorityEnrichmentsForEntity,
  buildNorbertNobleTitleIndex,
  buildPackNameIndex,
  firstAuthorityEnrichment,
  packTypedNamesForEntity,
  type NameBackfillProgress,
  type NameBackfillResult,
} from './nameBackfill';
import { suggestPersonNameSplit, suggestPersonRomanization } from '../plugins/personNameDefaults';
import { autoRomanize } from '../utilities/romanize';
import { fetchWikidataLifespan } from './wikidataDates';
import { fetchWikidataNationality } from './wikidataNationality';
import { fetchWikidataPlaceOfBirth } from './wikidataPlaceOfBirth';
import { fetchWikidataPersonWorks } from './wikidataPersonWorks';
import { fetchWikidataWorkDetails } from './wikidataWorkDetails';

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
  } = {},
): Promise<NameBackfillResult> {
  const { entityIds, readPackFile, projectLang, desktopLanguage, signal, onProgress, fetchImpl } =
    options;

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

    const givenFamily = await collectGivenFamilyNamesForCandidate(
      candidate,
      projectLang,
      fetchImpl,
    );
    const familyNames = [
      ...(givenFamily.familyName ? [givenFamily.familyName] : []),
      ...(entity.familyName ? [entity.familyName] : []),
      ...(candidate.typedNames ?? [])
        .filter((name) => name.type === 'family')
        .map((name) => name.text),
    ];
    const typedNames = (await collectTypedNamesForCandidate(candidate, fetchImpl)).filter(
      (name) => name.type !== 'courtesy' || !isFamilyPrefixedCourtesyName(name.text, familyNames),
    );
    for (const typed of typedNames) {
      namePatches.push({
        text: typed.text,
        nameType: typed.type,
        language: typed.lang,
        source: entity.authorities[0]?.type,
      });
    }

    let familyName = !entity.familyName
      ? givenFamily.familyName ||
        typedNames.find((name) => name.type === 'family')?.text ||
        suggestPersonNameSplit(entity.names[0] ?? '', projectLang ?? null)?.familyName ||
        null
      : null;
    let givenName = !entity.givenName
      ? givenFamily.givenName ||
        typedNames.find((name) => name.type === 'given')?.text ||
        suggestPersonNameSplit(entity.names[0] ?? '', projectLang ?? null)?.givenName ||
        null
      : null;

    let romanized: { text: string; language?: string | null } | null = null;
    if (!entity.romanized) {
      const authorityRomanized = metadata?.pinyin ?? metadata?.yomi;
      const text =
        authorityRomanized?.trim() ||
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

    for (const { source, enrichment } of authorityEnrichmentsForEntity(entity, packIndex)) {
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
      for (const title of nobleTitleIndex.get(norbertIdno.value.trim()) ?? []) {
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

    const wikidataIdno = entity.authorities.find(
      (auth) => auth.type.trim().toUpperCase() === 'WIKIDATA',
    );
    if (wikidataIdno) {
      const [lifespan, nationality, placeOfBirth] = await Promise.all([
        fetchWikidataLifespan(wikidataIdno.value, fetchImpl).catch(() => null),
        fetchWikidataNationality(wikidataIdno.value, fetchImpl, projectLang).catch(() => null),
        fetchWikidataPlaceOfBirth(wikidataIdno.value, fetchImpl, projectLang).catch(() => null),
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
  }

  return {
    entitiesScanned,
    entitiesUpdated,
    namesAdded,
    skippedNoAuthority,
    cancelled,
  };
}
