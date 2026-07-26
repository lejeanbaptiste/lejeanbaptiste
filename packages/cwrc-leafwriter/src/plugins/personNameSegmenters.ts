export interface PluginPersonNameSegmentResult {
  familyName: string;
  givenName: string;
  romanizedName: string | null;
}

export type PluginPersonNameSegmentInput = {
  name: string;
  projectLang: string | null;
  /** Host-provided romanizer (toneless pinyin, Wylie, etc.). */
  romanize: (part: string) => string | null;
};

export type PluginPersonNameSegmenter = (
  input: PluginPersonNameSegmentInput,
) => PluginPersonNameSegmentResult | null;

const segmenters = new Map<string, PluginPersonNameSegmenter>();

export function registerPluginPersonNameSegmenter(
  pluginId: string,
  segmenter: PluginPersonNameSegmenter,
): void {
  segmenters.set(pluginId, segmenter);
}

export function clearPluginPersonNameSegmentersForPlugin(pluginId: string): void {
  segmenters.delete(pluginId);
}

export function clearAllPluginPersonNameSegmenters(): void {
  segmenters.clear();
}

/** First registered segmenter that returns a result wins (registration order ≈ plugin load order). */
export function segmentPersonNameWithPlugins(
  name: string,
  projectLang: string | null,
  romanize: (part: string) => string | null,
): PluginPersonNameSegmentResult | null {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed) return null;
  for (const segmenter of segmenters.values()) {
    const result = segmenter({ name: trimmed, projectLang, romanize });
    if (result?.familyName && result.givenName) return result;
  }
  return null;
}
