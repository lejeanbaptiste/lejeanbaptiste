import type { PackRow } from '../../services/authority-pack-lookup';
import { describePackRow } from '../../services/authority-pack-lookup';
import { normalizeNameType } from '../nameTypes';
import { norbertAuthorityLookupValues } from '../norbertAuthorityId';
import type { EntitySummary } from '../entityOps';
import type { HygienePeer } from './types';

export type PackPersonSource = 'cbdb' | 'dila' | 'norbert';

export interface PackPersonHit {
  source: PackPersonSource;
  row: PackRow;
}

export interface PersonPackLookupIndex {
  /** Exact search-string / primary-name → pack hits */
  byName: Map<string, PackPersonHit[]>;
  /** `${source}:${authorityId}` → pack hit */
  byAuthority: Map<string, PackPersonHit>;
}

/**
 * One-pass index of person packs keyed by exact search-string forms and by
 * authority id. Avoids re-scanning multi‑MB ndjson for every entity during
 * hygiene scans.
 */
export async function buildPersonPackLookupIndex(
  packs: { source: PackPersonSource; content: string | string[] }[],
  options?: {
    yieldEvery?: number;
    yieldFn?: () => Promise<void>;
    signal?: AbortSignal;
  },
): Promise<PersonPackLookupIndex> {
  const byName = new Map<string, PackPersonHit[]>();
  const byAuthority = new Map<string, PackPersonHit>();
  /** Tracks authority keys already stored under each name (avoids O(n) scans). */
  const nameAuthorityKeys = new Map<string, Set<string>>();
  const yieldEvery = options?.yieldEvery ?? 2_000;
  const yieldFn = options?.yieldFn;
  let parsed = 0;

  const addName = (key: string, hit: PackPersonHit) => {
    const normalized = key.normalize('NFC').trim();
    if (!normalized) return;
    const authKey = `${hit.source}:${hit.row.authorityId}`;
    let seen = nameAuthorityKeys.get(normalized);
    if (!seen) {
      seen = new Set();
      nameAuthorityKeys.set(normalized, seen);
    }
    if (seen.has(authKey)) return;
    seen.add(authKey);
    const list = byName.get(normalized);
    if (list) list.push(hit);
    else byName.set(normalized, [hit]);
  };

  for (const pack of packs) {
    const lines = Array.isArray(pack.content) ? pack.content : pack.content.split('\n');
    for (const line of lines) {
      if (options?.signal?.aborted) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row: PackRow;
      try {
        row = JSON.parse(trimmed) as PackRow;
      } catch {
        continue;
      }
      if (!row.authorityId || !row.primaryName) continue;
      const hit: PackPersonHit = { source: pack.source, row };
      byAuthority.set(`${pack.source}:${row.authorityId}`, hit);
      // Norbert entities may store person-123 while pack rows use bare 123.
      if (pack.source === 'norbert') {
        for (const key of norbertAuthorityLookupValues(String(row.authorityId))) {
          byAuthority.set(`norbert:${key}`, hit);
        }
      }
      addName(row.primaryName, hit);
      for (const search of row.searchStrings ?? []) addName(search, hit);
      parsed += 1;
      if (yieldFn && parsed % yieldEvery === 0) await yieldFn();
    }
  }
  return { byName, byAuthority };
}

export function lookupPackPeers(
  index: PersonPackLookupIndex,
  queries: string[],
): Extract<HygienePeer, { kind: 'authority' }>[] {
  const peers: Extract<HygienePeer, { kind: 'authority' }>[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    // Index keys are NFC-trimmed; a Map hit is already an exact name match.
    const hits = index.byName.get(query.normalize('NFC').trim()) ?? [];
    for (const hit of hits) {
      // Unlinked-hit scan is CBDB/DILA only.
      if (hit.source !== 'cbdb' && hit.source !== 'dila') continue;
      const key = `${hit.source}:${hit.row.authorityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = hit.row.metadata;
      peers.push({
        kind: 'authority',
        authorityType: hit.source.toUpperCase(),
        authorityValue: String(hit.row.authorityId),
        primaryName: hit.row.primaryName ?? '',
        romanized: meta?.pinyin ?? null,
        startYear: meta?.startYear ?? null,
        endYear: meta?.endYear ?? null,
        nationalities: meta?.dynasty ? [meta.dynasty] : [],
        description: describePackRow(hit.row) ?? null,
        courtesyNames: (hit.row.names ?? [])
          .filter((name) => normalizeNameType(name.type ?? null) === 'courtesy')
          .map((name) => name.text),
      });
    }
  }
  return peers;
}

export function descriptionFromPackIndex(
  index: PersonPackLookupIndex,
  authorityType: string,
  authorityValue: string,
): string | undefined {
  const type = authorityType.toLowerCase();
  if (type !== 'cbdb' && type !== 'dila' && type !== 'norbert') return undefined;
  const hit = hitForAuthority(index, type, authorityValue);
  return hit ? describePackRow(hit.row) : undefined;
}

function hitForAuthority(
  index: PersonPackLookupIndex,
  source: string,
  authorityValue: string,
): PackPersonHit | undefined {
  const type = source.toLowerCase();
  if (type === 'norbert') {
    for (const key of norbertAuthorityLookupValues(authorityValue)) {
      const hit = index.byAuthority.get(`norbert:${key}`);
      if (hit) return hit;
    }
    return undefined;
  }
  return index.byAuthority.get(`${type}:${authorityValue}`);
}

/** Prefer pack-typed 姓/名 when an entity is linked to CBDB / DILA / Norbert. */
export function familyGivenFromPackIndex(
  index: PersonPackLookupIndex,
  entity: Pick<EntitySummary, 'authorities'>,
): { familyName: string; givenName: string; source: string } | null {
  for (const auth of entity.authorities) {
    const type = auth.type.trim().toLowerCase();
    if (type !== 'cbdb' && type !== 'dila' && type !== 'norbert') continue;
    const hit = hitForAuthority(index, type, auth.value);
    if (!hit) continue;
    let familyName: string | undefined;
    let givenName: string | undefined;
    for (const name of hit.row.names ?? []) {
      const normalized = normalizeNameType(name.type ?? null);
      if (normalized === 'family' && !familyName) familyName = name.text.normalize('NFC').trim();
      if (normalized === 'given' && !givenName) givenName = name.text.normalize('NFC').trim();
    }
    if (familyName && givenName) {
      return { familyName, givenName, source: type.toUpperCase() };
    }
  }
  return null;
}
