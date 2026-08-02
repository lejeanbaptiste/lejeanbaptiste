/**
 * Cache the expensive, pack-derived half of Norbert's second pass. The
 * compact wiki noble-title rows are expanded only once per installed-pack
 * generation, rather than once for every review-session refresh.
 */

import type { AuthorityCandidate } from './authority';
import type { AuthorityPackId } from './packPaths';
import { iterateAuthorityNdjson, type AuthorityPackContent } from './packLoader';
import { expandNorbertWikiNtCandidate } from './norbertWikiNt';

export type ReadAuthorityPack = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

let cache = new WeakMap<ReadAuthorityPack, Promise<AuthorityCandidate[]>>();

async function loadCandidates(readPackFile: ReadAuthorityPack): Promise<AuthorityCandidate[]> {
  const candidates: AuthorityCandidate[] = [];
  const wrapperContent = await readPackFile('norbert-person-wrappers');
  for (const candidate of iterateAuthorityNdjson(wrapperContent)) {
    if (candidate.metadata?.wrapper || candidate.metadata?.nobleTitle) candidates.push(candidate);
  }
  try {
    const wikiContent = await readPackFile('norbert-wiki-nt');
    for (const candidate of iterateAuthorityNdjson(wikiContent)) {
      for (const expanded of expandNorbertWikiNtCandidate(candidate)) {
        if (expanded.metadata?.wrapper || expanded.metadata?.nobleTitle) candidates.push(expanded);
      }
    }
  } catch {
    // The wiki asset is optional; the ordinary wrapper pack remains useful.
  }
  return candidates;
}

/** Return the shared, pack-derived Norbert wrapper/title candidates. */
export function getCachedNorbertExpanderCandidates(
  readPackFile: ReadAuthorityPack,
): Promise<AuthorityCandidate[]> {
  let pending = cache.get(readPackFile);
  if (!pending) {
    pending = loadCandidates(readPackFile).catch((error: unknown) => {
      cache.delete(readPackFile);
      throw error;
    });
    cache.set(readPackFile, pending);
  }
  return pending;
}

/** Drop derived candidates whenever authority-pack contents are refreshed. */
export function clearNorbertExpanderCache(): void {
  cache = new WeakMap<ReadAuthorityPack, Promise<AuthorityCandidate[]>>();
}
