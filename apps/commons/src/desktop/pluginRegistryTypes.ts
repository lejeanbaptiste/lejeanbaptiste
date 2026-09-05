/** GitHub Release registry for installable Grognard plugin archives. */
export const GROGNARD_PLUGIN_REGISTRY = {
  releaseDownloadBaseUrl: 'https://github.com/grognard/plugins/releases/latest/download',
} as const;

export const PLUGINS_INDEX_FILENAME = 'plugins-index.json';

export interface PluginReleaseEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  license: string;
  languages?: string[];
  regions?: string[];
  manifest: Record<string, unknown>;
  fileName: string;
  bytes: number;
  sha256: string;
}

export interface PluginReleaseIndex {
  schemaVersion: 1;
  builtAt: string;
  plugins: PluginReleaseEntry[];
}

export const pluginIndexUrl = (registry = GROGNARD_PLUGIN_REGISTRY): string =>
  `${registry.releaseDownloadBaseUrl}/${PLUGINS_INDEX_FILENAME}`;

export const pluginArtifactUrl = (fileName: string, registry = GROGNARD_PLUGIN_REGISTRY): string =>
  `${registry.releaseDownloadBaseUrl}/${fileName.replace(/^\//, '')}`;

const SHA256_RE = /^[0-9a-f]{64}$/;

export const parsePluginReleaseIndex = (raw: string): PluginReleaseIndex | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<PluginReleaseIndex>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.builtAt !== 'string' ||
      !Array.isArray(parsed.plugins)
    )
      return null;
    for (const plugin of parsed.plugins) {
      if (
        !plugin ||
        typeof plugin.id !== 'string' ||
        typeof plugin.name !== 'string' ||
        typeof plugin.version !== 'string' ||
        typeof plugin.description !== 'string' ||
        typeof plugin.license !== 'string' ||
        typeof plugin.fileName !== 'string' ||
        typeof plugin.bytes !== 'number' ||
        !SHA256_RE.test(plugin.sha256 ?? '') ||
        !plugin.manifest ||
        typeof plugin.manifest !== 'object'
      )
        return null;
    }
    return parsed as PluginReleaseIndex;
  } catch {
    return null;
  }
};
