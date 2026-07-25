import type { AuthorityPackSpec } from '../autoTagging/packPaths';

/** Snapshot from desktop plugin host (apps/desktop/src/plugins). */
export interface PluginRecordView {
  id: string;
  name: string;
  version: string;
  description: string;
  license: string;
  author?: string;
  homepage?: string;
  languages: string[];
  enabled: boolean;
  manifestError?: string;
  manifest?: {
    languagePrompt?: { message: string; documentLanguages?: string[] };
    contributions?: PluginManifestContributionsView;
  };
}

export interface PluginHostSnapshotView {
  plugins: PluginRecordView[];
  state: {
    enabled: string[];
    dismissedLanguagePrompts: string[];
  };
}

export interface PluginManifestContributionsView {
  autoTagging?: { id: string; label: string; kind: string }[];
  authorityPacks?: { id: string; label: string; defaultTag?: string }[];
  toolsMenu?: { id: string; label: string }[];
}

export interface RegisteredPluginPackSpec extends AuthorityPackSpec {
  pluginId: string;
}
