/** Mirrors grognard/plugins plugin.manifest.json (manifestVersion 1.0.0). */

export const PLUGIN_MANIFEST_FILENAME = 'plugin.manifest.json';

export interface PluginManifestEntry {
  kind: 'javascript' | 'python' | 'hybrid';
  module?: string;
  python?: {
    module: string;
    runtime?: 'bundled' | 'system' | 'conda-env';
    runtimePath?: string;
  };
}

export interface PluginAuthorityPackInstall {
  source: 'bundled' | 'authoritypacks-release' | 'url';
  path?: string;
  releaseId?: string;
  url?: string;
  manifestPath?: string;
}

export interface PluginAuthorityPackContribution {
  id: string;
  label: string;
  defaultTag?: string;
  install: PluginAuthorityPackInstall;
}

export interface PluginAutoTaggingProducer {
  id: string;
  label: string;
  description?: string;
  kind: string;
  defaultEnabled?: boolean;
  tags?: string[];
}

export interface PluginContributions {
  toolsMenu?: { id: string; label: string; action?: string; separatorBefore?: boolean }[];
  fileMenu?: { id: string; label: string; action?: string; separatorBefore?: boolean }[];
  autoTagging?: PluginAutoTaggingProducer[];
  authorityPacks?: PluginAuthorityPackContribution[];
  settingsSections?: { id: string; label: string; description?: string }[];
  disambiguation?: {
    id: string;
    label: string;
    entityKind: string;
    description?: string;
    usesContextKeys?: string[];
  }[];
}

export interface PluginManifest {
  manifestVersion: string;
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  license: string;
  grognard: { minVersion: string; maxVersion?: string };
  languages?: string[];
  regions?: string[];
  languagePrompt?: { message: string; documentLanguages?: string[] };
  entry: PluginManifestEntry;
  contributions?: PluginContributions;
  dependencies?: { plugins?: string[] };
  bundled?: string[];
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  license: string;
  author?: string;
  homepage?: string;
  languages: string[];
  enabled: boolean;
  installPath: string;
  manifest: PluginManifest;
  manifestError?: string;
}

export interface PluginHostState {
  enabled: string[];
  dismissedLanguagePrompts: string[];
}

export interface PluginHostSnapshot {
  plugins: PluginRecord[];
  state: PluginHostState;
}
