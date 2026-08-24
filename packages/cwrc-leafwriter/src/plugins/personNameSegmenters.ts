import { defaultChineseNameSegmenter } from './defaultChineseNameSegmenter';

export interface PluginPersonNameSegmentResult {
  familyName: string;
  givenName: string;
  romanizedName: string | null;
}

export interface PluginPersonNameSegmentInput {
  name: string;
  projectLang: string | null;
  /** Host-provided romanizer (toneless pinyin, Wylie, etc.). */
  romanize: (part: string) => string | null;
}

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

/**
 * First registered segmenter that returns a result wins (registration order
 * ≈ plugin load order). When every registered plugin declines — including a
 * plugin that's active but has no entry for this particular name (e.g.
 * Norbert without a stored pinyin reading) — a built-in default segmenter
 * has a last-resort try, so common names still split even without plugin
 * help.
 */
export function segmentPersonNameWithPlugins(
  name: string,
  projectLang: string | null,
  romanize: (part: string) => string | null,
): PluginPersonNameSegmentResult | null {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed) return null;
  // Pandas/NumPy missing-value token — never a personal name in any language.
  if (/^nan$/i.test(trimmed)) return null;
  for (const segmenter of segmenters.values()) {
    const result = segmenter({ name: trimmed, projectLang, romanize });
    if (result?.familyName && result.givenName) return result;
  }
  const fallback = defaultChineseNameSegmenter({ name: trimmed, projectLang, romanize });
  if (fallback?.familyName && fallback.givenName) return fallback;
  return null;
}
