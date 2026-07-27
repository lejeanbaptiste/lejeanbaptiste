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
  type EntitySummary,
} from './entityOps';
import { normalizeNameType, type NameTypeId } from './nameTypes';

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
  const out: TypedName[] = [];
  for (const name of names) {
    const text = name.text?.trim();
    if (!text) continue;
    const type = normalizeNameType(name.type) ?? 'variant';
    if (type === 'primary') continue;
    out.push({ text, type, lang: name.lang });
  }
  return out;
}

async function buildPackNameIndex(
  readPackFile: (packId: AuthorityPackId) => Promise<AuthorityPackContent>,
): Promise<Map<string, TypedName[]>> {
  const index = new Map<string, TypedName[]>();
  const packs: { packId: AuthorityPackId; source: string }[] = [
    { packId: 'cbdb-persons', source: 'CBDB' },
    { packId: 'dila-persons', source: 'DILA' },
  ];
  for (const { packId, source } of packs) {
    try {
      const content = await readPackFile(packId);
      for (const row of iterateAuthorityNdjson(content)) {
        const typed = typedNamesFromPackRow(row.names);
        if (typed.length === 0) continue;
        index.set(`${source}:${row.authorityId}`, typed);
      }
    } catch {
      // Pack missing or unreadable — skip silently.
    }
  }
  return index;
}

function packTypedNamesForEntity(
  entity: EntitySummary,
  index: Map<string, TypedName[]> | null,
): TypedName[] {
  if (!index) return [];
  const byText = new Map<string, TypedName>();
  for (const auth of entity.authorities) {
    const key = `${auth.type}:${auth.value.trim()}`;
    const names = index.get(key);
    if (!names) continue;
    for (const name of names) {
      byText.set(name.text.normalize('NFC'), name);
    }
  }
  return [...byText.values()];
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
): boolean {
  const beforeType = nameTypeForText(doc, entityId, typed.text);
  const added = addEntityName(doc, entityId, typed.text, { type: typed.type, lang: typed.lang });
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
    signal?: AbortSignal;
    onProgress?: (p: NameBackfillProgress) => void;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<NameBackfillResult> {
  const { entityIds, readPackFile, projectLang, signal, onProgress, fetchImpl } = options;

  const allPersons = listEntities(doc).filter((entity) => entity.kind === 'person');
  const idFilter = entityIds ? new Set(entityIds) : null;
  const targets = allPersons.filter(
    (entity) => entity.authorities.length > 0 && (!idFilter || idFilter.has(entity.id)),
  );

  const skippedNoAuthority = idFilter
    ? entityIds!.filter((id) => {
        const entity = allPersons.find((row) => row.id === id);
        return !entity || entity.authorities.length === 0;
      }).length
    : allPersons.filter((entity) => entity.authorities.length === 0).length;

  const packIndex = readPackFile ? await buildPackNameIndex(readPackFile) : null;

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

    const typedNames = await collectTypedNamesForCandidate(candidate, fetchImpl);
    const givenFamily = await collectGivenFamilyNamesForCandidate(candidate, projectLang, fetchImpl);

    for (const typed of typedNames) {
      if (applyTypedName(doc, entity.id, typed)) {
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

    if (entityChanged) entitiesUpdated++;
    namesAdded += addedThisEntity;

    onProgress?.({
      done: entitiesScanned,
      total: targets.length,
      entityId: entity.id,
      entityLabel: entity.names[0],
      addedNames: addedThisEntity,
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
