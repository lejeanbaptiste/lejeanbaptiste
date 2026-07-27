import type { AuthorityCandidate } from '../autoTagging/authority';

/**
 * Supplies wrapper-shaped candidates for the compound person-wrapper pass
 * (the same shape `expandNorbertWikiNtCandidate` produces), computed however
 * the plugin likes rather than read from a static bundled pack.
 */
export type PluginPatternTagProducer = () =>
  | AuthorityCandidate[]
  | Promise<AuthorityCandidate[]>;

const producers = new Map<string, PluginPatternTagProducer>();

export function registerPluginPatternTagProducer(
  pluginId: string,
  producer: PluginPatternTagProducer,
): void {
  producers.set(pluginId, producer);
}

export async function collectPluginPatternTagCandidates(): Promise<AuthorityCandidate[]> {
  const out: AuthorityCandidate[] = [];
  for (const producer of producers.values()) {
    out.push(...(await producer()));
  }
  return out;
}

export function clearPluginPatternTagProducer(pluginId: string): void {
  producers.delete(pluginId);
}

export function clearAllPluginPatternTagProducers(): void {
  producers.clear();
}
