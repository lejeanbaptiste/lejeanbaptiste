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

export interface PluginAutoTaggingProducerView {
  id: string;
  label: string;
  description?: string;
  kind: string;
  defaultEnabled?: boolean;
  tags?: string[];
}

export interface PluginToolsMenuItemView {
  id: string;
  label: string;
  action?: string;
  separatorBefore?: boolean;
}

export interface PluginManifestContributionsView {
  autoTagging?: PluginAutoTaggingProducerView[];
  authorityPacks?: { id: string; label: string; defaultTag?: string }[];
  toolsMenu?: PluginToolsMenuItemView[];
  fileMenu?: PluginToolsMenuItemView[];
}

export interface RegisteredPluginPackSpec extends AuthorityPackSpec {
  pluginId: string;
}

export interface RegisteredAutoTaggingProducer extends PluginAutoTaggingProducerView {
  pluginId: string;
}

export interface RegisteredToolsMenuItem extends PluginToolsMenuItemView {
  pluginId: string;
  action: string;
}
