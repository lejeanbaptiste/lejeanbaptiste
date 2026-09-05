import { AUTHORITY_PACKS, type AuthorityPackSpec } from '../autoTagging/packPaths';
import { setDynamicAuthorityPackSpecs } from '../autoTagging/packPaths';
import { loadEnabledPluginModules } from './pluginLoader';
import type {
  PluginHostSnapshotView,
  RegisteredAutoTaggingProducer,
  RegisteredPluginPackSpec,
  RegisteredToolsMenuItem,
} from './types';

let snapshot: PluginHostSnapshotView | null = null;
let registeredPackSpecs: RegisteredPluginPackSpec[] = [];
let registeredAutoTaggingProducers: RegisteredAutoTaggingProducer[] = [];
let registeredToolsMenuItems: RegisteredToolsMenuItem[] = [];

function rebuildPackSpecs(next: PluginHostSnapshotView | null) {
  registeredPackSpecs = [];
  if (!next) return;

  for (const plugin of next.plugins) {
    if (!plugin.enabled || plugin.manifestError) continue;
    const packs = plugin.manifest?.contributions?.authorityPacks;
    if (!packs?.length) continue;
    for (const pack of packs) {
      const builtIn = AUTHORITY_PACKS.find((spec) => spec.id === pack.id);
      if (builtIn) {
        registeredPackSpecs.push({ pluginId: plugin.id, ...builtIn });
        continue;
      }
      const folder = pack.id.replace(/-(persons|places|works|offices)$/, '');
      const suffix = pack.id.match(/-(persons|places|works|offices)$/)?.[1] ?? 'persons';
      const fileName =
        suffix === 'persons'
          ? 'persons.ndjson'
          : suffix === 'places'
            ? 'places.ndjson'
            : suffix === 'offices'
              ? 'offices.ndjson'
              : 'works.ndjson';
      registeredPackSpecs.push({
        pluginId: plugin.id,
        id: pack.id as AuthorityPackSpec['id'],
        label: pack.label,
        source: 'norbert',
        relativePath: `${folder}/${fileName}`,
        defaultTag: pack.defaultTag ?? 'persName',
      });
    }
  }
  setDynamicAuthorityPackSpecs(registeredPackSpecs);
}

function rebuildContributions(next: PluginHostSnapshotView | null) {
  registeredAutoTaggingProducers = [];
  registeredToolsMenuItems = [];
  if (!next) return;

  for (const plugin of next.plugins) {
    if (!plugin.enabled || plugin.manifestError) continue;

    for (const producer of plugin.manifest?.contributions?.autoTagging ?? []) {
      registeredAutoTaggingProducers.push({
        pluginId: plugin.id,
        ...producer,
      });
    }

    for (const item of plugin.manifest?.contributions?.toolsMenu ?? []) {
      registeredToolsMenuItems.push({
        pluginId: plugin.id,
        ...item,
        action: item.action ?? `${plugin.id}.${item.id}`,
      });
    }
  }
}

export async function refreshPluginRegistry(): Promise<PluginHostSnapshotView | null> {
  const previousEnabled = new Set(snapshot?.state.enabled ?? []);
  const next = await window.electronAPI?.pluginsGetSnapshot?.();
  snapshot = next ?? null;
  rebuildPackSpecs(snapshot);
  rebuildContributions(snapshot);
  await loadEnabledPluginModules(snapshot, previousEnabled);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('grognardPluginRegistryChanged'));
  }
  return snapshot;
}

export function getPluginRegistrySnapshot(): PluginHostSnapshotView | null {
  return snapshot;
}

export function getRegisteredPluginPackSpecs(): RegisteredPluginPackSpec[] {
  return registeredPackSpecs;
}

export function getRegisteredAutoTaggingProducers(
  pluginId?: string,
): RegisteredAutoTaggingProducer[] {
  if (!pluginId) return registeredAutoTaggingProducers;
  return registeredAutoTaggingProducers.filter((producer) => producer.pluginId === pluginId);
}

export function getRegisteredToolsMenuItems(pluginId?: string): RegisteredToolsMenuItem[] {
  if (!pluginId) return registeredToolsMenuItems;
  return registeredToolsMenuItems.filter((item) => item.pluginId === pluginId);
}

export function findRegisteredToolsMenuAction(action: string): RegisteredToolsMenuItem | undefined {
  return registeredToolsMenuItems.find((item) => item.action === action);
}

export function getEnabledPluginIds(): string[] {
  return snapshot?.state.enabled ?? [];
}

export function isPluginEnabled(pluginId: string): boolean {
  return getEnabledPluginIds().includes(pluginId);
}

export function isCjkDatesEnabled(): boolean {
  if (!isPluginEnabled('cjk-dates')) return false;
  const producers = getRegisteredAutoTaggingProducers('cjk-dates');
  if (producers.length === 0) return true;
  return producers.some((p) => p.kind === 'dates' || p.kind === 'custom');
}

export function findLanguagePromptForDocumentLanguage(lang: string | undefined): {
  pluginId: string;
  message: string;
} | null {
  if (!lang || !snapshot) return null;
  const normalized = lang.toLowerCase();
  for (const plugin of snapshot.plugins) {
    if (plugin.enabled || plugin.manifestError) continue;
    const prompt = plugin.manifest?.languagePrompt;
    const langs = prompt?.documentLanguages ?? plugin.languages ?? [];
    if (!langs.some((l) => normalized.startsWith(l.toLowerCase()))) continue;
    if (snapshot.state.dismissedLanguagePrompts.includes(plugin.id)) continue;
    if (!prompt?.message) continue;
    return { pluginId: plugin.id, message: prompt.message };
  }
  return null;
}

export function setPluginRegistrySnapshot(next: PluginHostSnapshotView | null) {
  snapshot = next;
  rebuildPackSpecs(snapshot);
  rebuildContributions(snapshot);
}
