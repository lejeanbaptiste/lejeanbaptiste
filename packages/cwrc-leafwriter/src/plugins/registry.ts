import type { AuthorityPackSpec } from '../autoTagging/packPaths';
import { setDynamicAuthorityPackSpecs } from '../autoTagging/packPaths';
import type { PluginHostSnapshotView, RegisteredPluginPackSpec } from './types';

let snapshot: PluginHostSnapshotView | null = null;
let registeredPackSpecs: RegisteredPluginPackSpec[] = [];

function rebuildPackSpecs(next: PluginHostSnapshotView | null) {
  registeredPackSpecs = [];
  if (!next) return;

  for (const plugin of next.plugins) {
    if (!plugin.enabled || plugin.manifestError) continue;
    const packs = plugin.manifest?.contributions?.authorityPacks;
    if (!packs?.length) continue;
    for (const pack of packs) {
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

export async function refreshPluginRegistry(): Promise<PluginHostSnapshotView | null> {
  const next = await window.electronAPI?.pluginsGetSnapshot?.();
  snapshot = next ?? null;
  rebuildPackSpecs(snapshot);
  return snapshot;
}

export function getPluginRegistrySnapshot(): PluginHostSnapshotView | null {
  return snapshot;
}

export function getRegisteredPluginPackSpecs(): RegisteredPluginPackSpec[] {
  return registeredPackSpecs;
}

export function getEnabledPluginIds(): string[] {
  return snapshot?.state.enabled ?? [];
}

export function isPluginEnabled(pluginId: string): boolean {
  return getEnabledPluginIds().includes(pluginId);
}

export function isCjkDatesEnabled(): boolean {
  return isPluginEnabled('cjk-dates');
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
}
