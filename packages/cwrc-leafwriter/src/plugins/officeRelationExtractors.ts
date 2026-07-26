import type { AuthorityCandidate } from '../autoTagging/authority';

export interface OfficeRelationExtractionInput {
  first: AuthorityCandidate;
  second: AuthorityCandidate;
  adjacent: boolean;
}

export interface ExtractedOfficeRelation {
  source: string;
  rule: string;
  sourceIds: string[];
  confidence: 'asserted' | 'inferred';
}

export type PluginOfficeRelationExtractor = (
  input: OfficeRelationExtractionInput,
) => ExtractedOfficeRelation | null;

const extractors = new Map<string, PluginOfficeRelationExtractor>();

export function registerPluginOfficeRelationExtractor(
  pluginId: string,
  extractor: PluginOfficeRelationExtractor,
): void {
  extractors.set(pluginId, extractor);
}

export function extractPluginOfficeRelations(
  input: OfficeRelationExtractionInput,
): ExtractedOfficeRelation[] {
  const out: ExtractedOfficeRelation[] = [];
  for (const extractor of extractors.values()) {
    const relation = extractor(input);
    if (relation) out.push(relation);
  }
  return out;
}

export function clearPluginOfficeRelationExtractor(pluginId: string): void {
  extractors.delete(pluginId);
}

export function clearAllPluginOfficeRelationExtractors(): void {
  extractors.clear();
}
