/**
 * Resolve-on-select for the entity lookup dialog (manual twin of the Phase 4b
 * disambiguation accept path). When the user picks an external authority
 * result, this maps it onto the project's entities.xml: direct idno hit →
 * link, crosswalk hit via installed authority packs → link + enrich, no hit →
 * mint. Idnos are written only when resolution is unique; anything ambiguous
 * returns a conflict for the user to settle and files a curation warning.
 *
 * Split into a pure `planLookupResolution` (no writes) and
 * `applyLookupResolution` (re-plans against a fresh read, then writes) so the
 * dialog can show a confirm step without having touched entities.xml yet.
 */
import type { NamedEntityType } from '../types';
import { autoRomanize } from '../utilities/romanize';
import { LOOKUP_TYPE_TO_KIND } from '../services/entity-database-lookup';
import { autoSyncEntityToCentral } from './autoSync';
import {
  ENTITY_KINDS,
  type AuthorityId,
  type AuthoritySourcedFields,
  type EntityKind,
} from './entities';
import type { OriginAssertion } from './authority';
import type { EntityStore } from './entityStore';
import {
  assertLookupSqliteStore,
  enrichEntitySqlite,
  mintEntitySqlite,
} from './sqliteLookupMint';
import { isLatinSurface } from './disambiguationMatch';
import {
  bareNorbertAuthorityValue,
  formatNorbertAuthorityValue,
} from './norbertAuthorityId';
import { romanizeFromAuthorityMetadata } from '../utilities/romanize';
import { suggestPersonNameSplit, suggestPersonRomanization } from '../plugins/personNameDefaults';
import type { AuthorityPackId } from './packPaths';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import { WARNINGS_FILE } from './lookupWarnings';
import type { LookupWarning } from './lookupWarnings';
import type { SqlitePanelSummaryLike } from './sqliteSummary';
import { typedNamesFromPackRow, type TypedName } from './disambiguationCandidates';
import { preferCanonicalFamilyGiven } from './nameTypes';

export const LJB_LOOKUP_RESP = '#ljb-lookup';

/* ------------------------------------------------------------------------ */
/* URI → (authority, id)                                                     */
/* ------------------------------------------------------------------------ */

export interface ParsedAuthorityRef {
  /** Canonical `<idno type>`: CBDB, DILA, Wikidata, VIAF, NDL, … */
  idnoType: string;
  /** Key into `AuthorityCandidate.metadata.crosswalk`, when the packs know this source. */
  crosswalkKey?: string;
  value: string;
}

const URI_PATTERNS: {
  pattern: RegExp;
  idnoType: string;
  crosswalkKey?: string;
  transform?: (value: string) => string;
}[] = [
  {
    pattern: /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i,
    idnoType: 'Wikidata',
    crosswalkKey: 'wikidata',
    transform: (v) => v.toUpperCase(),
  },
  { pattern: /viaf\.org\/(?:[a-z]{2}\/)?viaf\/(\d+)/i, idnoType: 'VIAF', crosswalkKey: 'viaf' },
  {
    pattern: /cbdb\.fas\.harvard\.edu\/[^\s]*?id=(\d+)/i,
    idnoType: 'CBDB',
    crosswalkKey: 'cbdb',
  },
  {
    pattern: /authority\.dila\.edu\.tw\/[^\s]*?(?:aid=|fromInner=|code=|\/)([A-Z]{1,2}\d+)/,
    idnoType: 'DILA',
    crosswalkKey: 'dila',
  },
  { pattern: /id\.ndl\.go\.jp\/auth\/(?:ndlna|ndlsh)\/(\w+)/i, idnoType: 'NDL', crosswalkKey: 'ndl' },
  { pattern: /geonames\.org\/(\d+)/i, idnoType: 'Geonames' },
  { pattern: /vocab\.getty\.edu\/(?:tgn|ulan|aat)\/([\w-]+)/i, idnoType: 'Getty' },
  { pattern: /d-nb\.info\/gnd\/([\w-]+)/i, idnoType: 'GND' },
];

export function parseAuthorityUri(uri: string): ParsedAuthorityRef | null {
  const localPack = uri.match(
    /^urn:ljb:authority:(cbdb|norbert):(person|place|office):(.+)$/i,
  );
  if (localPack) {
    const source = localPack[1]!.toLowerCase();
    const entityType = localPack[2]!.toLowerCase();
    const bareId = localPack[3]!;
    // Norbert person/office tables share a numeric id space — store typed
    // values (`person-12`) so authority-duplicate checks stay honest.
    // CBDB keeps bare ids (its person/office spaces do not collide in LJB).
    const value =
      source === 'norbert' ? `${entityType}-${bareId}` : bareId;
    return {
      idnoType: source === 'cbdb' ? 'CBDB' : 'NORBERT',
      crosswalkKey: source,
      value,
    };
  }
  for (const { pattern, idnoType, crosswalkKey, transform } of URI_PATTERNS) {
    const match = uri.match(pattern);
    if (match) {
      const value = transform ? transform(match[1]!) : match[1]!;
      return { idnoType, crosswalkKey, value };
    }
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Concordance scan over installed packs                                     */
/* ------------------------------------------------------------------------ */

/** crosswalk key → canonical idno type. */
const CROSSWALK_IDNO_TYPES: Record<string, string> = {
  cbdb: 'CBDB',
  chgis: 'CHGIS',
  dila: 'DILA',
  wikidata: 'Wikidata',
  viaf: 'VIAF',
  ndl: 'NDL',
  bdrc: 'BDRC',
  norbert: 'NORBERT',
};

/** Pack source id → canonical idno type for the candidate's own authorityId. */
const SOURCE_IDNO_TYPES: Record<string, string> = {
  cbdb: 'CBDB',
  chgis: 'CHGIS',
  dila: 'DILA',
  wikidata: 'Wikidata',
  ndl: 'NDL',
  norbert: 'NORBERT',
};

export interface CrosswalkResult {
  /** All authority ids the concordance ties to the reference (including it). */
  idnos: AuthorityId[];
  /** Best pack row, for enriching a minted entity. */
  candidate?: {
    source: string;
    primaryName: string;
    description?: string;
    startYear?: number;
    endYear?: number;
    pinyin?: string;
    yomi?: string;
    nationality?: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[];
    origin?: OriginAssertion[];
    /** Pack `names[]` short forms (bare 姓/名/字, …) for link-time enrichment. */
    typedNames?: TypedName[];
  };
}

interface PackRow {
  kind?: string;
  source?: string;
  authorityId?: string;
  primaryName?: string;
  names?: { text: string; type?: string; lang?: string }[];
  metadata?: {
    description?: string;
    startYear?: number;
    endYear?: number;
    nationality?: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[];
    origin?: OriginAssertion[];
    pinyin?: string;
    yomi?: string;
    crosswalk?: Record<string, string | string[] | undefined>;
  };
}

function rowMatchesRef(row: PackRow, ref: ParsedAuthorityRef): boolean {
  const sourceType = row.source ? SOURCE_IDNO_TYPES[row.source.toLowerCase()] : undefined;
  if (sourceType === ref.idnoType) {
    const rowId = String(row.authorityId);
    if (rowId === ref.value) return true;
    // Typed Norbert idnos (`person-12`) still match bare pack authorityIds.
    if (
      ref.idnoType === 'NORBERT' &&
      bareNorbertAuthorityValue(ref.value) === bareNorbertAuthorityValue(rowId)
    ) {
      return true;
    }
  }

  if (!ref.crosswalkKey) return false;
  const entry = row.metadata?.crosswalk?.[ref.crosswalkKey];
  if (entry == null) return false;
  const want = bareNorbertAuthorityValue(ref.value);
  return Array.isArray(entry)
    ? entry.some((v) => bareNorbertAuthorityValue(String(v)) === want)
    : bareNorbertAuthorityValue(String(entry)) === want;
}

function idnosFromRow(row: PackRow): AuthorityId[] {
  const out: AuthorityId[] = [];
  const sourceType = row.source ? SOURCE_IDNO_TYPES[row.source.toLowerCase()] : undefined;
  if (sourceType && row.authorityId != null) {
    const bare = String(row.authorityId);
    const value =
      sourceType === 'NORBERT'
        ? formatNorbertAuthorityValue(row.kind, bare)
        : bare;
    out.push({ type: sourceType, value });
  }
  for (const [key, entry] of Object.entries(row.metadata?.crosswalk ?? {})) {
    const type = CROSSWALK_IDNO_TYPES[key];
    if (!type || entry == null) continue;
    const values = Array.isArray(entry) ? entry : [entry];
    for (const value of values) {
      // Crosswalk norbert ids are bare person ids from other packs.
      const formatted =
        type === 'NORBERT' && key === 'norbert'
          ? formatNorbertAuthorityValue('person', value)
          : String(value);
      out.push({ type, value: formatted });
    }
  }
  return out;
}

export function dedupeIdnos(ids: AuthorityId[]): AuthorityId[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = `${id.type.toLowerCase()}\0${id.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Stream installed packs for rows tied to the reference. Lines are
 * pre-filtered with a plain substring test before JSON parsing, so a full
 * scan stays cheap even on large packs; this runs once per confirm click.
 */
export async function crosswalkForRef(
  ref: ParsedAuthorityRef,
  packIds: AuthorityPackId[],
  readPackFile: (packId: AuthorityPackId) => Promise<AuthorityPackContent>,
): Promise<CrosswalkResult> {
  const idnos: AuthorityId[] = [{ type: ref.idnoType, value: ref.value }];
  let candidate: CrosswalkResult['candidate'];

  for (const packId of packIds) {
    let content: AuthorityPackContent;
    try {
      content = await readPackFile(packId);
    } catch {
      continue; // pack listed but unreadable — skip, don't fail the lookup
    }
    for (const line of authorityPackLines(content)) {
      if (!line.includes(ref.value)) continue;
      let row: PackRow;
      try {
        row = JSON.parse(line) as PackRow;
      } catch {
        continue;
      }
      if (!rowMatchesRef(row, ref)) continue;
      idnos.push(...idnosFromRow(row));
      if (!candidate && row.primaryName) {
        candidate = {
          source: (row.source ?? 'authority').toUpperCase(),
          primaryName: row.primaryName,
          description: row.metadata?.description,
          startYear: row.metadata?.startYear,
          endYear: row.metadata?.endYear,
          pinyin: row.metadata?.pinyin,
          yomi: row.metadata?.yomi,
          nationality: row.metadata?.nationality,
          origin: row.metadata?.origin,
          typedNames: typedNamesFromPackRow(row.names),
        };
      }
    }
  }

  return { idnos: dedupeIdnos(idnos), candidate };
}

/* ------------------------------------------------------------------------ */
/* Plan                                                                      */
/* ------------------------------------------------------------------------ */

export interface LookupSelectionInput {
  uri: string;
  label: string;
  description?: string;
  entityType: NamedEntityType;
  /** The (possibly user-edited) query string, logged as the mention surface. */
  query: string;
  /** URIs of other authority candidates checked alongside the primary one — their idnos get added to the same entity. */
  extraUris?: string[];
}

export interface LookupResolveDeps {
  store: EntityStore;
  packIds?: AuthorityPackId[];
  readPackFile?: (packId: AuthorityPackId) => Promise<AuthorityPackContent>;
  /** Document the mention lives in, for the decision log. */
  documentId?: string;
  /** Project source language; when set, minted names carry xml:lang + a romanization. */
  projectLang?: string | null;
}

export interface LookupConflictCandidate {
  key: string;
  name: string;
  description?: string;
}

export type LookupResolutionPlan =
  | {
      action: 'link';
      key: string;
      entityName: string;
      description?: string;
      matchedBy: 'direct' | 'crosswalk';
      authoritySource?: string;
      /** Concordance idnos the entity is missing (written on apply). */
      addIdnos: AuthorityId[];
      /** Same-type/different-value clashes — never written, surfaced as warnings. */
      idnoConflicts: AuthorityId[];
      startYear?: number;
      endYear?: number;
      nationality?: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[];
      /** Per-authority raw values, when more than one checked reference resolved via the packs. */
      authorityAssertions?: AuthoritySourcedFields[];
      /** Pack short forms to attach when linking an existing person. */
      typedNames?: TypedName[];
      familyName?: string;
      givenName?: string;
    }
  | {
      action: 'mint';
      entityName: string;
      idnos: AuthorityId[];
      description?: string;
      startYear?: number;
      endYear?: number;
      authoritySource?: string;
      nationality?: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[];
      /** Per-authority raw values, when more than one checked reference resolved via the packs. */
      authorityAssertions?: AuthoritySourcedFields[];
      /** Latin-script name (authority pinyin/yomi or autogenerated). */
      romanizedName?: string;
      /** Person family/given — pack typed names, else Norbert / surname-table split. */
      familyName?: string;
      givenName?: string;
      /** Pack short forms (bare 姓/名/字, …) written as typed names on mint. */
      typedNames?: TypedName[];
    }
  | { action: 'conflict'; candidates: LookupConflictCandidate[]; idnos: AuthorityId[] }
  /** Entity type has no home in entities.xml (thing/concept) — plain URI link. */
  | { action: 'passthrough' };

interface EntityRecord {
  key: string;
  name: string;
  description?: string;
  idnos: AuthorityId[];
}

async function collectEntityIdsByAuthorities(
  store: EntityStore,
  kind: EntityKind,
  authorities: AuthorityId[],
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const authority of authorities) {
    const matches = await store.sqliteFindAllByAuthority(
      kind,
      authority.type,
      authority.value,
    );
    for (const id of matches) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function entityRecordFromSqlite(
  store: EntityStore,
  entityId: string,
): Promise<EntityRecord | null> {
  const raw = (await store.sqliteEntitySummary(entityId)) as SqlitePanelSummaryLike | null;
  if (!raw) return null;
  const primary =
    raw.names.find((name) => name.status === 'active' && name.nameType === 'primary') ??
    raw.names.find((name) => name.status === 'active');
  return {
    key: raw.id,
    name: primary?.text?.trim() || raw.id,
    description: raw.description?.trim() || undefined,
    idnos: (raw.authorities ?? []).map((authority) => ({
      type: authority.type,
      value: authority.value,
    })),
  };
}

async function hydrateEntityRecords(
  store: EntityStore,
  entityIds: string[],
): Promise<EntityRecord[]> {
  const records: EntityRecord[] = [];
  for (const id of entityIds) {
    const record = await entityRecordFromSqlite(store, id);
    if (record) records.push(record);
  }
  return records;
}

export const idnoEquals = (a: AuthorityId, b: AuthorityId) =>
  a.type.toLowerCase() === b.type.toLowerCase() && a.value === b.value;

const entityHasIdno = (entity: EntityRecord, idno: AuthorityId) =>
  entity.idnos.some((own) => idnoEquals(own, idno));

function toConflictCandidates(entities: EntityRecord[]): LookupConflictCandidate[] {
  return entities.map(({ key, name, description }) => ({ key, name, description }));
}

/**
 * Family/given + typed short forms from a pack crosswalk hit (Phase B).
 * Prefers bare 姓/名 in pack `names[]`; falls back to surname-table split.
 */
function personEnrichmentFromPackCandidate(
  candidate: CrosswalkResult['candidate'] | undefined,
  projectLang?: string | null,
): { typedNames?: TypedName[]; familyName?: string; givenName?: string } {
  if (!candidate) return {};
  const typedNames = candidate.typedNames;
  const preferred = preferCanonicalFamilyGiven(candidate.primaryName, typedNames ?? []);
  const needsSplit = !preferred.familyName || !preferred.givenName;
  const split = needsSplit
    ? suggestPersonNameSplit(candidate.primaryName, projectLang ?? null)
    : null;
  return {
    ...(typedNames?.length ? { typedNames } : {}),
    familyName: preferred.familyName ?? split?.familyName,
    givenName: preferred.givenName ?? split?.givenName,
  };
}

/** Split concordance idnos into "safe to add" and "clashes with an existing value". */
function splitEnrichment(entity: EntityRecord, idnos: AuthorityId[]) {
  const addIdnos: AuthorityId[] = [];
  const idnoConflicts: AuthorityId[] = [];
  for (const idno of idnos) {
    if (entityHasIdno(entity, idno)) continue;
    const sameType = entity.idnos.find(
      (own) => own.type.toLowerCase() === idno.type.toLowerCase(),
    );
    if (sameType) idnoConflicts.push(idno);
    else addIdnos.push(idno);
  }
  return { addIdnos, idnoConflicts };
}

export async function planLookupResolution(
  input: LookupSelectionInput,
  deps: LookupResolveDeps,
): Promise<LookupResolutionPlan> {
  const kind = LOOKUP_TYPE_TO_KIND[input.entityType];
  if (!kind) return { action: 'passthrough' };

  await assertLookupSqliteStore(deps.store);

  const refs: ParsedAuthorityRef[] = [input.uri, ...(input.extraUris ?? [])].map(
    (uri) => parseAuthorityUri(uri) ?? { idnoType: 'URI', value: uri },
  );

  // Concordance expansion only for recognized authorities — a pasted URL is
  // not disambiguated against the packs. Each checked candidate's ref is
  // expanded independently, then the results are merged into one idno set.
  const crosswalks: CrosswalkResult[] = await Promise.all(
    refs.map((ref) =>
      deps.readPackFile && deps.packIds?.length
        ? crosswalkForRef(ref, deps.packIds, deps.readPackFile)
        : Promise.resolve({ idnos: [{ type: ref.idnoType, value: ref.value }] }),
    ),
  );
  const idnos = dedupeIdnos(crosswalks.flatMap((c) => c.idnos));
  const candidateMetas = crosswalks
    .map((c) => c.candidate)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const candidateMeta = candidateMetas[0];
  const authorityAssertions: AuthoritySourcedFields[] | undefined = candidateMetas.length
    ? candidateMetas
        .map((meta) => ({
          source: meta.source.toUpperCase(),
          startYear: meta.startYear,
          endYear: meta.endYear,
          nationality: meta.nationality?.map((value) => ({
            canonicalId: value.canonicalId,
            label: value.label,
          })),
          origin: meta.origin,
        }))
        .filter(
          (assertion) =>
            assertion.startYear != null ||
            assertion.endYear != null ||
            assertion.nationality?.length ||
            assertion.origin?.length,
        )
    : undefined;

  const directIds = await collectEntityIdsByAuthorities(
    deps.store,
    kind,
    refs.map((ref) => ({ type: ref.idnoType, value: ref.value })),
  );
  const direct = await hydrateEntityRecords(deps.store, directIds);

  if (direct.length > 1) {
    // Pre-existing duplicate — a curation problem, never a merge-by-lookup.
    return { action: 'conflict', candidates: toConflictCandidates(direct), idnos };
  }

  if (direct.length === 1) {
    const entity = direct[0]!;
    const packPerson =
      kind === 'person'
        ? personEnrichmentFromPackCandidate(candidateMeta, deps.projectLang)
        : {};
    return {
      action: 'link',
      key: entity.key,
      entityName: entity.name,
      description: entity.description,
      matchedBy: 'direct',
      authoritySource: candidateMeta?.source,
      ...splitEnrichment(entity, idnos),
      startYear: candidateMeta?.startYear,
      endYear: candidateMeta?.endYear,
      nationality: candidateMeta?.nationality,
      authorityAssertions,
      ...packPerson,
    };
  }

  const viaCrosswalkIds = await collectEntityIdsByAuthorities(deps.store, kind, idnos);
  const viaCrosswalk = await hydrateEntityRecords(deps.store, viaCrosswalkIds);

  if (viaCrosswalk.length > 1) {
    return {
      action: 'conflict',
      candidates: toConflictCandidates(viaCrosswalk),
      idnos,
    };
  }

  if (viaCrosswalk.length === 1) {
    const entity = viaCrosswalk[0]!;
    const packPerson =
      kind === 'person'
        ? personEnrichmentFromPackCandidate(candidateMeta, deps.projectLang)
        : {};
    return {
      action: 'link',
      key: entity.key,
      entityName: entity.name,
      description: entity.description,
      matchedBy: 'crosswalk',
      authoritySource: candidateMeta?.source,
      ...splitEnrichment(entity, idnos),
      startYear: candidateMeta?.startYear,
      endYear: candidateMeta?.endYear,
      nationality: candidateMeta?.nationality,
      authorityAssertions,
      ...packPerson,
    };
  }

  const entityName = candidateMeta?.primaryName ?? input.label;
  // Authority-provided pinyin/yomi wins outright. Otherwise, for persons,
  // split family/given first (Norbert, or the built-in surname-table
  // fallback) and romanize from the split — "Zhou Shixiong", not the
  // per-character "Zhou Shi Xiong" a whole-string fallback would produce.
  const packPerson =
    kind === 'person'
      ? personEnrichmentFromPackCandidate(candidateMeta, deps.projectLang)
      : {};
  const hasAuthorityRomanization = Boolean(
    candidateMeta?.pinyin?.trim() || candidateMeta?.yomi?.trim(),
  );
  const personSplit =
    !hasAuthorityRomanization &&
    kind === 'person' &&
    !packPerson.familyName &&
    !packPerson.givenName
      ? suggestPersonNameSplit(entityName, deps.projectLang ?? null)
      : null;
  const romanizedName = hasAuthorityRomanization
    ? (romanizeFromAuthorityMetadata(candidateMeta, entityName, deps.projectLang) ?? undefined)
    : personSplit || packPerson.familyName
      ? (suggestPersonRomanization(entityName, deps.projectLang ?? null) ?? undefined)
      : (autoRomanize(entityName, deps.projectLang) ?? undefined);
  return {
    action: 'mint',
    entityName,
    idnos,
    description: input.description ?? candidateMeta?.description,
    startYear: candidateMeta?.startYear,
    endYear: candidateMeta?.endYear,
    authoritySource: candidateMeta?.source,
    nationality: candidateMeta?.nationality,
    authorityAssertions,
    romanizedName,
    familyName: packPerson.familyName ?? personSplit?.familyName,
    givenName: packPerson.givenName ?? personSplit?.givenName,
    typedNames: packPerson.typedNames,
  };
}

/* ------------------------------------------------------------------------ */
/* Apply                                                                     */
/* ------------------------------------------------------------------------ */

async function appendWarnings(store: EntityStore, warnings: LookupWarning[]): Promise<void> {
  if (warnings.length === 0) return;
  const existing = (await store.readProjectLjbFile(WARNINGS_FILE)) ?? '';
  const body =
    (existing && !existing.endsWith('\n') ? existing + '\n' : existing) +
    warnings.map((warning) => JSON.stringify(warning)).join('\n') +
    '\n';
  await store.writeProjectLjbFile(WARNINGS_FILE, body);
}

async function logDecision(
  input: LookupSelectionInput,
  deps: LookupResolveDeps,
  kind: EntityKind,
  entityId: string,
): Promise<void> {
  await deps.store.appendDecisions([
    {
      when: new Date().toISOString(),
      documentId: deps.documentId ?? 'entity-lookup',
      surface: input.query,
      tag: ENTITY_KINDS[kind].name,
      action: 'resolved',
      source: 'manual-lookup',
      entityId,
      scope: 'selection',
    },
  ]);
}

export type LookupResolutionResult =
  | { status: 'linked'; key: string; entityName: string; wasCreated: boolean }
  | { status: 'conflict'; candidates: LookupConflictCandidate[] }
  | { status: 'passthrough' };

/**
 * Re-plan against a fresh read of entities.xml (the entity panel may have
 * merged/deleted entities since the plan was shown), then write.
 */
export async function applyLookupResolution(
  input: LookupSelectionInput,
  deps: LookupResolveDeps,
): Promise<LookupResolutionResult> {
  const plan = await planLookupResolution(input, deps);
  const kind = LOOKUP_TYPE_TO_KIND[input.entityType];

  if (plan.action === 'passthrough' || !kind) return { status: 'passthrough' };

  if (plan.action === 'conflict') {
    return { status: 'conflict', candidates: plan.candidates };
  }

  await assertLookupSqliteStore(deps.store);

  if (plan.action === 'link') {
    if (
      plan.addIdnos.length > 0 ||
      (plan.nationality?.length ?? 0) > 0 ||
      plan.startYear != null ||
      plan.endYear != null ||
      plan.authorityAssertions?.length ||
      plan.familyName ||
      plan.givenName
    ) {
      await enrichEntitySqlite(deps.store, plan.key, {
        kind,
        authorityIds: plan.addIdnos,
        startYear: plan.startYear,
        endYear: plan.endYear,
        nationality: plan.nationality,
        authorityAssertions: plan.authorityAssertions,
        authoritySource: plan.authoritySource ?? parseAuthorityUri(input.uri)?.idnoType ?? 'authority',
        familyName: plan.familyName,
        givenName: plan.givenName,
      });
    }
    for (const typed of plan.typedNames ?? []) {
      await deps.store.sqliteAddName({
        entityId: plan.key,
        text: typed.text,
        nameType: typed.type,
        language: typed.lang,
        origin: 'authority',
        source: plan.authoritySource,
      });
    }
    if (plan.idnoConflicts.length > 0) {
      await appendWarnings(
        deps.store,
        plan.idnoConflicts.map((idno) => ({
          when: new Date().toISOString(),
          kind: 'idno-conflict' as const,
          entityIds: [plan.key],
          authority: idno.type,
          value: idno.value,
          detail: `lookup of ${input.uri} implies ${idno.type}:${idno.value}, but ${plan.key} already carries a different ${idno.type} idno`,
        })),
      );
    }
    await logDecision(input, deps, kind, plan.key);
    return { status: 'linked', key: plan.key, entityName: plan.entityName, wasCreated: false };
  }

  // mint
  const id = await mintEntitySqlite(deps.store, {
    kind,
    name: plan.entityName,
    nameLang:
      deps.projectLang && !isLatinSurface(plan.entityName) ? deps.projectLang : undefined,
    romanizedName: plan.romanizedName,
    authorityIds: plan.idnos,
    authoritySource: plan.authoritySource,
    description: plan.description,
    startYear: kind === 'person' && plan.authorityAssertions?.length ? undefined : plan.startYear,
    endYear: kind === 'person' && plan.authorityAssertions?.length ? undefined : plan.endYear,
    nationality:
      kind === 'person' && plan.authorityAssertions?.length ? undefined : plan.nationality,
    authorityAssertions: kind === 'person' ? plan.authorityAssertions : undefined,
    familyName: plan.familyName,
    givenName: plan.givenName,
  });
  for (const typed of plan.typedNames ?? []) {
    await deps.store.sqliteAddName({
      entityId: id,
      text: typed.text,
      nameType: typed.type,
      language: typed.lang,
      origin: 'authority',
      source: plan.authoritySource,
    });
  }
  await autoSyncEntityToCentral(null, id);
  await logDecision(input, deps, kind, id);
  return { status: 'linked', key: id, entityName: plan.entityName, wasCreated: true };
}

export async function appendExtraAuthorityIds(
  key: string,
  extraUris: string[],
  deps: LookupResolveDeps,
): Promise<void> {
  const refs = extraUris.map(parseAuthorityUri).filter((ref): ref is ParsedAuthorityRef => !!ref);
  if (refs.length === 0) return;

  await assertLookupSqliteStore(deps.store);
  const toAdd = dedupeIdnos(refs.map((ref) => ({ type: ref.idnoType, value: ref.value })));
  if (toAdd.length === 0) return;
  for (const authority of toAdd) {
    await deps.store.sqliteAttachAuthority(key, authority.type, authority.value);
  }
}

/**
 * Link a conflict choice: tag points at the chosen entity, but no idnos are
 * written — the conflict is filed for the entity panel to curate.
 */
export async function linkWithoutEnrichment(
  key: string,
  entityName: string,
  candidates: LookupConflictCandidate[],
  input: LookupSelectionInput,
  deps: LookupResolveDeps,
): Promise<LookupResolutionResult> {
  const kind = LOOKUP_TYPE_TO_KIND[input.entityType];
  if (!kind) return { status: 'passthrough' };

  const ref = parseAuthorityUri(input.uri) ?? { idnoType: 'URI', value: input.uri };
  await appendWarnings(deps.store, [
    {
      when: new Date().toISOString(),
      kind: 'concordance-conflict',
      entityIds: candidates.map((candidate) => candidate.key),
      authority: ref.idnoType,
      value: ref.value,
      detail: `lookup of ${input.uri} matched multiple entities; user linked ${key}`,
    },
  ]);
  await logDecision(input, deps, kind, key);
  return { status: 'linked', key, entityName, wasCreated: false };
}

/**
 * Tag without linking to an external authority: find an existing project entity
 * whose name matches the surface exactly, or mint a local-only record (no
 * `<idno>`), then return its `@key`.
 */
export async function linkLocalEntityWithoutAuthority(
  entityType: NamedEntityType,
  query: string,
  deps: LookupResolveDeps,
): Promise<LookupResolutionResult> {
  const kind = LOOKUP_TYPE_TO_KIND[entityType];
  const surface = query.normalize('NFC').trim();
  if (!kind || !surface) return { status: 'passthrough' };

  await assertLookupSqliteStore(deps.store);
  const input: LookupSelectionInput = {
    uri: '',
    label: surface,
    entityType,
    query: surface,
  };

  const hits = (await deps.store.sqliteSearchNames(kind, surface, 20)) ?? [];
  const existing = hits.find((hit) => hit.label.normalize('NFC') === surface);
  if (existing) {
    await logDecision(input, deps, kind, existing.id);
    return {
      status: 'linked',
      key: existing.id,
      entityName: existing.label,
      wasCreated: false,
    };
  }

  const personSplit =
    kind === 'person' ? suggestPersonNameSplit(surface, deps.projectLang ?? null) : null;
  const romanizedName = personSplit
    ? (suggestPersonRomanization(surface, deps.projectLang ?? null) ?? undefined)
    : (autoRomanize(surface, deps.projectLang) ?? undefined);

  const id = await mintEntitySqlite(deps.store, {
    kind,
    name: surface,
    nameLang:
      deps.projectLang && !isLatinSurface(surface) ? deps.projectLang : undefined,
    romanizedName,
    familyName: personSplit?.familyName,
    givenName: personSplit?.givenName,
  });
  await autoSyncEntityToCentral(null, id);
  await logDecision(input, deps, kind, id);
  return { status: 'linked', key: id, entityName: surface, wasCreated: true };
}
