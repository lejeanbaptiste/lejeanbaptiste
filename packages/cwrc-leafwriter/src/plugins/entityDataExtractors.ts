export interface EntityDataAssertion {
  /** TEI child to create, e.g. nationality, nobleTitle, placeName, state. */
  element: string;
  value: string;
  ref?: string;
  /** Optional nested XML for structured values such as nobleTitle. */
  children?: { element: string; value: string; ref?: string }[];
}

export interface EntityDataExtractionInput {
  wrapper: Element;
  /** Stable document identifier used to make source keys portable. */
  documentKey: string;
}

export type PluginEntityDataExtractor = (input: EntityDataExtractionInput) => EntityDataAssertion[];

const extractors = new Map<string, PluginEntityDataExtractor>();

export function registerPluginEntityDataExtractor(
  pluginId: string,
  extractor: PluginEntityDataExtractor,
): void {
  extractors.set(pluginId, extractor);
}

export function extractRegisteredEntityData(
  input: EntityDataExtractionInput,
): EntityDataAssertion[] {
  const output: EntityDataAssertion[] = [];
  for (const extractor of extractors.values()) output.push(...extractor(input));
  return output;
}

export function clearPluginEntityDataExtractor(pluginId: string): void {
  extractors.delete(pluginId);
}

export function clearAllPluginEntityDataExtractors(): void {
  extractors.clear();
}
