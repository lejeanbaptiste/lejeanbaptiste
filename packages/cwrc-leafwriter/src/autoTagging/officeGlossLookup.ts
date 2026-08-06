/**
 * Office gloss sidecars:
 * - Huckbot5000 → English (`metadata.translation`) for blank pack glosses
 * - MaxiRicci7000 → French (`metadata.translationFr`) without overwriting English
 */
import type { AuthorityCandidate } from './authority';
import type { AuthorityPackContent } from './packLoader';
import { authorityPackLines } from './packLoader';
import type { AuthorityPackId } from './packPaths';

export const HUCKBOT_TRANSLATIONS_PACK_ID: AuthorityPackId = 'huckbot5000-translations';
export const MAXIRICCI_TRANSLATIONS_PACK_ID: AuthorityPackId = 'maxiricci7000-translations';

export type OfficeGlossIndex = Map<string, string>;

/** French index: officeId keys plus zh / zh\\tdynasty fallbacks for Batch A. */
export type FrenchOfficeGlossIndex = {
  byOfficeId: Map<string, string>;
  byZhDynasty: Map<string, string>;
  byZh: Map<string, string>;
};

type GlossRow = {
  translation?: string;
  officeIds?: string[];
  zh?: string;
  dynasty?: string;
  language?: string;
};

/** `州縣長吏 (Senior Subalterns…, 宋)` — matches cbdbOfficeClue shape. */
export function formatOfficeClue(
  name: string,
  translation?: string | null,
  dynasty?: string | null,
): string {
  const inner = [translation, dynasty].filter((part): part is string => Boolean(part?.trim()));
  if (inner.length) return `${name} (${inner.join(', ')})`;
  return name;
}

function normalizeZh(zh: string | undefined): string {
  return String(zh ?? '').normalize('NFKC').trim();
}

function zhDynastyKey(zh: string, dynasty: string | null | undefined): string {
  return `${normalizeZh(zh)}\t${String(dynasty ?? '').trim()}`;
}

/** Build officeId → English gloss from the Huckbot translations NDJSON. */
export function buildHuckbotGlossIndex(content: AuthorityPackContent): OfficeGlossIndex {
  const index: OfficeGlossIndex = new Map();
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: GlossRow;
    try {
      row = JSON.parse(trimmed) as GlossRow;
    } catch {
      continue;
    }
    const gloss = row.translation?.trim();
    if (!gloss) continue;
    for (const officeId of row.officeIds ?? []) {
      const key = officeId.trim();
      if (key && !index.has(key)) index.set(key, gloss);
    }
  }
  return index;
}

/** Build French gloss indexes from MaxiRicci7000 translations NDJSON. */
export function buildMaxiRicciGlossIndex(content: AuthorityPackContent): FrenchOfficeGlossIndex {
  const byOfficeId: Map<string, string> = new Map();
  const byZhDynasty: Map<string, string> = new Map();
  const byZh: Map<string, string> = new Map();

  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: GlossRow;
    try {
      row = JSON.parse(trimmed) as GlossRow;
    } catch {
      continue;
    }
    const gloss = row.translation?.trim();
    if (!gloss) continue;
    // Prefer language:fr rows when present; accept untagged legacy rows.
    if (row.language && row.language !== 'fr') continue;

    for (const officeId of row.officeIds ?? []) {
      const key = officeId.trim();
      if (key && !byOfficeId.has(key)) byOfficeId.set(key, gloss);
    }
    const zh = normalizeZh(row.zh);
    if (!zh) continue;
    const zd = zhDynastyKey(zh, row.dynasty);
    if (!byZhDynasty.has(zd)) byZhDynasty.set(zd, gloss);
    if (!byZh.has(zh)) byZh.set(zh, gloss);
  }
  return { byOfficeId, byZhDynasty, byZh };
}

function officeEntityIdsForCandidate(candidate: AuthorityCandidate): string[] {
  const ids = new Set<string>();
  const meta = candidate.metadata;
  if (meta?.entityId) ids.add(meta.entityId);
  if (meta?.canonicalEntityId) ids.add(meta.canonicalEntityId);
  const source = String(candidate.source ?? '')
    .trim()
    .toLowerCase();
  if (source && candidate.authorityId) {
    ids.add(`${source}:office:${candidate.authorityId}`);
  }
  return [...ids];
}

function lookupFrenchGloss(
  index: FrenchOfficeGlossIndex,
  ids: string[],
  zh: string | undefined,
  dynasty: string | null | undefined,
): string | undefined {
  for (const id of ids) {
    const hit = index.byOfficeId.get(id);
    if (hit) return hit;
  }
  const name = normalizeZh(zh);
  if (!name) return undefined;
  if (dynasty) {
    const hit = index.byZhDynasty.get(zhDynastyKey(name, dynasty));
    if (hit) return hit;
  }
  return index.byZh.get(name);
}

/**
 * Fill `metadata.translation` (and refresh `description`) when the office pack
 * row has no English gloss yet.
 */
export function applyHuckbotGlossToCandidate(
  candidate: AuthorityCandidate,
  glosses: OfficeGlossIndex,
): AuthorityCandidate {
  if (candidate.kind !== 'office' || !glosses.size) return candidate;
  if (candidate.metadata?.translation?.trim()) return candidate;

  let gloss: string | undefined;
  for (const id of officeEntityIdsForCandidate(candidate)) {
    gloss = glosses.get(id);
    if (gloss) break;
  }
  if (!gloss) return candidate;

  const dynasty = candidate.metadata?.dynasty;
  return {
    ...candidate,
    metadata: {
      ...candidate.metadata,
      translation: gloss,
      description: formatOfficeClue(candidate.primaryName, gloss, dynasty),
    },
  };
}

/** Attach French gloss without touching English `translation`. */
export function applyMaxiRicciGlossToCandidate(
  candidate: AuthorityCandidate,
  glosses: FrenchOfficeGlossIndex,
): AuthorityCandidate {
  if (candidate.kind !== 'office') return candidate;
  if (candidate.metadata?.translationFr?.trim()) return candidate;
  if (!glosses.byOfficeId.size && !glosses.byZh.size) return candidate;

  const gloss = lookupFrenchGloss(
    glosses,
    officeEntityIdsForCandidate(candidate),
    candidate.primaryName,
    candidate.metadata?.dynasty,
  );
  if (!gloss) return candidate;

  return {
    ...candidate,
    metadata: {
      ...candidate.metadata,
      translationFr: gloss,
    },
  };
}

/** Same fill for lookup `PackRow` shapes (authority-pack-lookup). */
export function applyHuckbotGlossToPackRow<
  T extends {
    primaryName?: string;
    authorityId?: string;
    metadata?: AuthorityCandidate['metadata'];
  },
>(row: T, source: string, glosses: OfficeGlossIndex): T {
  if (!glosses.size) return row;
  if (row.metadata?.translation?.trim()) return row;

  const ids = new Set<string>();
  if (row.metadata?.entityId) ids.add(row.metadata.entityId);
  if (row.metadata?.canonicalEntityId) ids.add(row.metadata.canonicalEntityId);
  const src = source.trim().toLowerCase();
  if (src && row.authorityId) ids.add(`${src}:office:${row.authorityId}`);

  let gloss: string | undefined;
  for (const id of ids) {
    gloss = glosses.get(id);
    if (gloss) break;
  }
  if (!gloss) return row;

  const name = row.primaryName?.trim() || '';
  return {
    ...row,
    metadata: {
      ...row.metadata,
      translation: gloss,
      description: formatOfficeClue(name, gloss, row.metadata?.dynasty),
    },
  };
}

export function applyMaxiRicciGlossToPackRow<
  T extends {
    primaryName?: string;
    authorityId?: string;
    metadata?: AuthorityCandidate['metadata'];
  },
>(row: T, source: string, glosses: FrenchOfficeGlossIndex): T {
  if (!glosses.byOfficeId.size && !glosses.byZh.size) return row;
  if (row.metadata?.translationFr?.trim()) return row;

  const ids: string[] = [];
  if (row.metadata?.entityId) ids.push(row.metadata.entityId);
  if (row.metadata?.canonicalEntityId) ids.push(row.metadata.canonicalEntityId);
  const src = source.trim().toLowerCase();
  if (src && row.authorityId) ids.push(`${src}:office:${row.authorityId}`);

  const gloss = lookupFrenchGloss(glosses, ids, row.primaryName, row.metadata?.dynasty);
  if (!gloss) return row;

  return {
    ...row,
    metadata: {
      ...row.metadata,
      translationFr: gloss,
    },
  };
}

let glossIndexPromise: Promise<OfficeGlossIndex> | null = null;
let frenchGlossIndexPromise: Promise<FrenchOfficeGlossIndex> | null = null;

type PackReader = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

/**
 * Session-cached Huckbot gloss index. Missing pack → empty map (older installs).
 */
export function loadHuckbotGlossIndex(readPack: PackReader): Promise<OfficeGlossIndex> {
  if (!glossIndexPromise) {
    glossIndexPromise = readPack(HUCKBOT_TRANSLATIONS_PACK_ID)
      .then((content) => buildHuckbotGlossIndex(content))
      .catch(() => new Map());
  }
  return glossIndexPromise;
}

export function loadMaxiRicciGlossIndex(readPack: PackReader): Promise<FrenchOfficeGlossIndex> {
  if (!frenchGlossIndexPromise) {
    frenchGlossIndexPromise = readPack(MAXIRICCI_TRANSLATIONS_PACK_ID)
      .then((content) => buildMaxiRicciGlossIndex(content))
      .catch(() => ({ byOfficeId: new Map(), byZhDynasty: new Map(), byZh: new Map() }));
  }
  return frenchGlossIndexPromise;
}

/** Drop cached gloss indexes (call with pack-content cache clears after reinstall). */
export function clearHuckbotGlossIndexCache(): void {
  glossIndexPromise = null;
}

export function clearMaxiRicciGlossIndexCache(): void {
  frenchGlossIndexPromise = null;
}

export function clearOfficeGlossIndexCaches(): void {
  clearHuckbotGlossIndexCache();
  clearMaxiRicciGlossIndexCache();
}
