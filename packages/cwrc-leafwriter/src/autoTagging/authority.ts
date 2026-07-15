import type { EntityKind } from './entities';

/** Standoff kinds plus compile-time `office` (corpus tag: roleName). */
export type AuthorityKind = EntityKind | 'office';

/**
 * A normalized authority record (Phase 4a). Every source — a CSV export, CBDB,
 * DILA, etc. — flattens into this shape, which the seed matcher then fires at
 * the corpus. Language-agnostic: just names + ids + optional disambiguating
 * metadata.
 */
export interface AuthorityCandidate {
  /** Source label, e.g. a table/file name, 'CBDB', 'DILA'. */
  source: string;
  /** Id within that source (becomes an <idno> on the minted entity). */
  authorityId: string;
  kind: AuthorityKind;
  /** Display/primary name for the entity. */
  primaryName: string;
  /** All strings that should match this entity in the corpus (primary + variants). */
  searchStrings: string[];
  /**
   * Typed names, when the pack export preserves name categories (字/號/…).
   * `type` is normalized via nameTypes.normalizeNameType; absent on packs
   * built before this field existed.
   */
  names?: { text: string; type?: string; lang?: string }[];
  metadata?: {
    dynasty?: string;
    startYear?: number;
    endYear?: number;
    /** Place subtype (county/mountain/…) or similar sub-classification. */
    subtype?: string;
    description?: string;
    teiTag?: string;
    ana?: string;
    crosswalk?: {
      cbdb?: string;
      chgis?: string;
      dila?: string;
      wikidata?: string[];
      viaf?: string;
      ndl?: string;
      bdrc?: string;
    };
    pinyin?: string;
    /** NDL ja-kana reading (katakana). */
    yomi?: string;
    /** Hiragana form of `yomi` for IME lookup. */
    yomiHiragana?: string;
    translation?: string;
    /** DILA `note type="disambiguation"` — not the same person as… */
    disambiguation?: string;
  };
}

/** Corpus TEI tag used when matching this candidate. */
export function teiTagForCandidate(candidate: AuthorityCandidate): string {
  if (candidate.kind === 'office') return candidate.metadata?.teiTag ?? 'roleName';
  const map: Record<EntityKind, string> = {
    person: 'persName',
    place: 'placeName',
    org: 'orgName',
    work: 'title',
  };
  return map[candidate.kind];
}

/**
 * Authority-table tag → entity kind. `ntName` folds into person.
 * `officeName` → office kind (tags as roleName).
 */
const TABLE_TAG_TO_KIND: Record<string, AuthorityKind> = {
  persName: 'person',
  ntName: 'person',
  placeName: 'place',
  orgName: 'org',
  officeName: 'office',
  title: 'work',
};

/** One raw row from an authority table, already column-mapped. */
export interface AuthorityRow {
  id: string;
  string: string;
  tag: string;
  subtype?: string;
  startYear?: number;
  endYear?: number;
  dynasty?: string;
  description?: string;
}

/**
 * Group rows into candidates, keyed by (kind, id): multiple rows for the same
 * id collect into one entity's searchStrings. The first non-empty string is
 * the primary name. Rows whose tag has no entity kind are skipped.
 */
export function candidatesFromRows(rows: AuthorityRow[], source: string): AuthorityCandidate[] {
  const byEntity = new Map<string, AuthorityCandidate>();

  for (const row of rows) {
    const kind = TABLE_TAG_TO_KIND[row.tag];
    if (!kind || !row.id || !row.string) continue;

    const key = `${kind}:${row.id}`;
    let candidate = byEntity.get(key);
    if (!candidate) {
      candidate = {
        source,
        authorityId: row.id,
        kind,
        primaryName: row.string,
        searchStrings: [],
      };
      byEntity.set(key, candidate);
    }
    if (!candidate.searchStrings.includes(row.string)) candidate.searchStrings.push(row.string);

    const meta: NonNullable<AuthorityCandidate['metadata']> = candidate.metadata ?? {};
    if (row.subtype) meta.subtype = row.subtype;
    if (row.dynasty) meta.dynasty = row.dynasty;
    if (row.startYear !== undefined) meta.startYear = row.startYear;
    if (row.endYear !== undefined) meta.endYear = row.endYear;
    if (row.description) meta.description = row.description;
    if (Object.keys(meta).length > 0) candidate.metadata = meta;
  }

  return [...byEntity.values()];
}

/**
 * Column mapping for a CSV authority table. Defaults match DPM's
 * `all_together.csv`; override names for other exports.
 */
export interface CsvColumnMap {
  id?: string[]; // first non-empty wins (e.g. person_id then office_id)
  string?: string;
  tag?: string;
  subtype?: string;
  startYear?: string;
  endYear?: string;
  dynasty?: string;
  description?: string;
}

const DEFAULT_CSV_MAP: Required<Pick<CsvColumnMap, 'id' | 'string' | 'tag'>> & CsvColumnMap = {
  id: ['person_id', 'office_id', 'id'],
  string: 'string',
  tag: 'tag',
  subtype: 'cat',
  startYear: 'start_year',
  endYear: 'end_year',
  dynasty: 'dynasty',
  description: 'description',
};

/** Ids sometimes arrive as floats ("3854.0"); normalize to a bare integer string. */
function cleanId(raw: string): string {
  const trimmed = raw.trim();
  const asFloat = /^(\d+)\.0+$/.exec(trimmed);
  return asFloat ? asFloat[1]! : trimmed;
}

function parseYear(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse an authority CSV into rows, respecting a (partial) column map. */
export function authorityRowsFromCsv(content: string, columns: CsvColumnMap = {}): AuthorityRow[] {
  const map = { ...DEFAULT_CSV_MAP, ...columns };
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  const col = (name?: string) => (name ? header.indexOf(name) : -1);
  const idCols = map.id.map((n) => header.indexOf(n)).filter((i) => i >= 0);
  const stringCol = col(map.string);
  const tagCol = col(map.tag);
  const subtypeCol = col(map.subtype);
  const startCol = col(map.startYear);
  const endCol = col(map.endYear);
  const dynastyCol = col(map.dynasty);
  const descCol = col(map.description);
  if (stringCol < 0 || tagCol < 0) return [];

  const rows: AuthorityRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const at = (index: number) => (index >= 0 ? cells[index]?.trim() ?? '' : '');

    const idRaw = idCols.map((c) => cells[c]?.trim() ?? '').find((v) => v.length > 0);
    const string = at(stringCol);
    const tag = at(tagCol);
    if (!idRaw || !string || !tag) continue;

    const row: AuthorityRow = { id: cleanId(idRaw), string, tag };
    const subtype = at(subtypeCol);
    if (subtype) row.subtype = subtype;
    const dynasty = at(dynastyCol);
    if (dynasty) row.dynasty = dynasty;
    const description = at(descCol);
    if (description) row.description = description;
    const start = parseYear(at(startCol));
    if (start !== undefined) row.startYear = start;
    const end = parseYear(at(endCol));
    if (end !== undefined) row.endYear = end;
    rows.push(row);
  }
  return rows;
}

/** Convenience: CSV string → candidates. */
export function candidatesFromCsv(
  content: string,
  source: string,
  columns: CsvColumnMap = {},
): AuthorityCandidate[] {
  return candidatesFromRows(authorityRowsFromCsv(content, columns), source);
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"' && current === '') {
      quoted = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
