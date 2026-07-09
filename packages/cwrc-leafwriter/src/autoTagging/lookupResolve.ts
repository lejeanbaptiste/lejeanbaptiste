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
import { LOOKUP_TYPE_TO_KIND } from '../services/entity-database-lookup';
import {
  addEntity,
  appendAuthorityIdnos,
  ENTITY_KINDS,
  findEntity,
  type AuthorityId,
  type EntityKind,
} from './entities';
import type { EntityStore } from './entityStore';
import type { AuthorityPackId } from './packPaths';

export const LJB_LOOKUP_RESP = '#ljb-lookup';
export const WARNINGS_FILE = 'entity-warnings.jsonl';

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
    pattern: /authority\.dila\.edu\.tw\/[^\s]*?(?:aid=|\/)([A-Z]{1,2}\d+)/,
    idnoType: 'DILA',
    crosswalkKey: 'dila',
  },
  { pattern: /id\.ndl\.go\.jp\/auth\/(?:ndlna|ndlsh)\/(\w+)/i, idnoType: 'NDL', crosswalkKey: 'ndl' },
  { pattern: /geonames\.org\/(\d+)/i, idnoType: 'Geonames' },
  { pattern: /vocab\.getty\.edu\/(?:tgn|ulan|aat)\/([\w-]+)/i, idnoType: 'Getty' },
  { pattern: /d-nb\.info\/gnd\/([\w-]+)/i, idnoType: 'GND' },
];

export function parseAuthorityUri(uri: string): ParsedAuthorityRef | null {
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
};

/** Pack source id → canonical idno type for the candidate's own authorityId. */
const SOURCE_IDNO_TYPES: Record<string, string> = {
  cbdb: 'CBDB',
  chgis: 'CHGIS',
  dila: 'DILA',
  wikidata: 'Wikidata',
  ndl: 'NDL',
};

export interface CrosswalkResult {
  /** All authority ids the concordance ties to the reference (including it). */
  idnos: AuthorityId[];
  /** Best pack row, for enriching a minted entity. */
  candidate?: {
    primaryName: string;
    description?: string;
    startYear?: number;
    endYear?: number;
  };
}

interface PackRow {
  source?: string;
  authorityId?: string;
  primaryName?: string;
  metadata?: {
    description?: string;
    startYear?: number;
    endYear?: number;
    crosswalk?: Record<string, string | string[] | undefined>;
  };
}

function rowMatchesRef(row: PackRow, ref: ParsedAuthorityRef): boolean {
  const sourceType = row.source ? SOURCE_IDNO_TYPES[row.source.toLowerCase()] : undefined;
  if (sourceType === ref.idnoType && String(row.authorityId) === ref.value) return true;

  if (!ref.crosswalkKey) return false;
  const entry = row.metadata?.crosswalk?.[ref.crosswalkKey];
  if (entry == null) return false;
  return Array.isArray(entry) ? entry.includes(ref.value) : String(entry) === ref.value;
}

function idnosFromRow(row: PackRow): AuthorityId[] {
  const out: AuthorityId[] = [];
  const sourceType = row.source ? SOURCE_IDNO_TYPES[row.source.toLowerCase()] : undefined;
  if (sourceType && row.authorityId != null) {
    out.push({ type: sourceType, value: String(row.authorityId) });
  }
  for (const [key, entry] of Object.entries(row.metadata?.crosswalk ?? {})) {
    const type = CROSSWALK_IDNO_TYPES[key];
    if (!type || entry == null) continue;
    const values = Array.isArray(entry) ? entry : [entry];
    for (const value of values) out.push({ type, value: String(value) });
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
  readPackFile: (packId: AuthorityPackId) => Promise<string>,
): Promise<CrosswalkResult> {
  const idnos: AuthorityId[] = [{ type: ref.idnoType, value: ref.value }];
  let candidate: CrosswalkResult['candidate'];

  for (const packId of packIds) {
    let content: string;
    try {
      content = await readPackFile(packId);
    } catch {
      continue; // pack listed but unreadable — skip, don't fail the lookup
    }
    for (const line of content.split('\n')) {
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
          primaryName: row.primaryName,
          description: row.metadata?.description,
          startYear: row.metadata?.startYear,
          endYear: row.metadata?.endYear,
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
}

export interface LookupResolveDeps {
  store: EntityStore;
  packIds?: AuthorityPackId[];
  readPackFile?: (packId: AuthorityPackId) => Promise<string>;
  /** Document the mention lives in, for the decision log. */
  documentId?: string;
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
      /** Concordance idnos the entity is missing (written on apply). */
      addIdnos: AuthorityId[];
      /** Same-type/different-value clashes — never written, surfaced as warnings. */
      idnoConflicts: AuthorityId[];
    }
  | {
      action: 'mint';
      entityName: string;
      idnos: AuthorityId[];
      description?: string;
      startYear?: number;
      endYear?: number;
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

function readEntitiesOfKind(doc: Document, kind: EntityKind): EntityRecord[] {
  const { item, name: nameTag } = ENTITY_KINDS[kind];
  const out: EntityRecord[] = [];
  const items = doc.getElementsByTagName(item);
  for (let i = 0; i < items.length; i++) {
    const el = items.item(i)!;
    const key = el.getAttribute('xml:id');
    if (!key) continue;
    const idnos: AuthorityId[] = [];
    const idnoEls = el.getElementsByTagName('idno');
    for (let j = 0; j < idnoEls.length; j++) {
      const idnoEl = idnoEls.item(j)!;
      idnos.push({
        type: idnoEl.getAttribute('type') ?? 'unknown',
        value: idnoEl.textContent?.trim() ?? '',
      });
    }
    let description: string | undefined;
    const noteEls = el.getElementsByTagName('note');
    for (let j = 0; j < noteEls.length; j++) {
      const noteEl = noteEls.item(j)!;
      if (noteEl.getAttribute('type') === 'description') {
        description = noteEl.textContent?.trim() || undefined;
        break;
      }
    }
    out.push({
      key,
      name: el.getElementsByTagName(nameTag)[0]?.textContent?.trim() ?? key,
      description,
      idnos,
    });
  }
  return out;
}

const idnoEquals = (a: AuthorityId, b: AuthorityId) =>
  a.type.toLowerCase() === b.type.toLowerCase() && a.value === b.value;

const entityHasIdno = (entity: EntityRecord, idno: AuthorityId) =>
  entity.idnos.some((own) => idnoEquals(own, idno));

function toConflictCandidates(entities: EntityRecord[]): LookupConflictCandidate[] {
  return entities.map(({ key, name, description }) => ({ key, name, description }));
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

  const parsed = parseAuthorityUri(input.uri);
  const ref: ParsedAuthorityRef = parsed ?? { idnoType: 'URI', value: input.uri };

  // Concordance expansion only for recognized authorities — a pasted URL is
  // not disambiguated against the packs.
  const crosswalk =
    parsed && deps.readPackFile && deps.packIds?.length
      ? await crosswalkForRef(ref, deps.packIds, deps.readPackFile)
      : { idnos: [{ type: ref.idnoType, value: ref.value }] as AuthorityId[] };

  const doc = await deps.store.loadEntities();
  const entities = readEntitiesOfKind(doc, kind);

  const refIdno: AuthorityId = { type: ref.idnoType, value: ref.value };
  const direct = entities.filter((entity) => entityHasIdno(entity, refIdno));

  if (direct.length > 1) {
    // Pre-existing duplicate — a curation problem, never a merge-by-lookup.
    return { action: 'conflict', candidates: toConflictCandidates(direct), idnos: crosswalk.idnos };
  }

  if (direct.length === 1) {
    const entity = direct[0]!;
    return {
      action: 'link',
      key: entity.key,
      entityName: entity.name,
      description: entity.description,
      matchedBy: 'direct',
      ...splitEnrichment(entity, crosswalk.idnos),
    };
  }

  const viaCrosswalk = entities.filter((entity) =>
    crosswalk.idnos.some((idno) => entityHasIdno(entity, idno)),
  );

  if (viaCrosswalk.length > 1) {
    return {
      action: 'conflict',
      candidates: toConflictCandidates(viaCrosswalk),
      idnos: crosswalk.idnos,
    };
  }

  if (viaCrosswalk.length === 1) {
    const entity = viaCrosswalk[0]!;
    return {
      action: 'link',
      key: entity.key,
      entityName: entity.name,
      description: entity.description,
      matchedBy: 'crosswalk',
      ...splitEnrichment(entity, crosswalk.idnos),
    };
  }

  return {
    action: 'mint',
    entityName: crosswalk.candidate?.primaryName ?? input.label,
    idnos: crosswalk.idnos,
    description: input.description ?? crosswalk.candidate?.description,
    startYear: crosswalk.candidate?.startYear,
    endYear: crosswalk.candidate?.endYear,
  };
}

/* ------------------------------------------------------------------------ */
/* Apply                                                                     */
/* ------------------------------------------------------------------------ */

export interface LookupWarning {
  when: string;
  kind: 'idno-conflict' | 'concordance-conflict';
  entityIds: string[];
  /** The clicked authority reference. */
  authority: string;
  value: string;
  detail?: string;
}

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

  if (plan.action === 'link') {
    if (plan.addIdnos.length > 0) {
      const doc = await deps.store.loadEntities();
      const element = findEntity(doc, plan.key);
      if (element) {
        appendAuthorityIdnos(doc, element, plan.addIdnos);
        await deps.store.saveEntities(doc);
      }
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
  const doc = await deps.store.loadEntities();
  const { id } = addEntity(
    doc,
    kind,
    {
      name: plan.entityName,
      authorityIds: plan.idnos,
      description: plan.description,
      startYear: plan.startYear,
      endYear: plan.endYear,
    },
    LJB_LOOKUP_RESP,
  );
  await deps.store.saveEntities(doc);
  await logDecision(input, deps, kind, id);
  return { status: 'linked', key: id, entityName: plan.entityName, wasCreated: true };
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
