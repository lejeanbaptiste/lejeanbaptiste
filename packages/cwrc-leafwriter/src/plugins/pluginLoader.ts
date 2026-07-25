import { clearPluginExtensionsForPlugin } from './pluginExtensions';
import { createPluginRegisterContext } from './registerContext';
import type { PluginHostSnapshotView } from './types';

const loadedPluginIds = new Set<string>();
const loadedContexts = new Map<string, ReturnType<typeof createPluginRegisterContext>>();

async function importPluginModule(url: string): Promise<{ register?: (ctx: unknown) => void | Promise<void> }> {
  return import(/* webpackIgnore: true */ url);
}

export async function loadEnabledPluginModules(
  snapshot: PluginHostSnapshotView | null,
  previousEnabled: Set<string> = new Set(),
): Promise<void> {
  if (!snapshot || !window.electronAPI?.pluginsGetModuleUrl) return;

  const enabledNow = new Set(snapshot.state.enabled);

  for (const pluginId of loadedPluginIds) {
    if (enabledNow.has(pluginId)) continue;
    loadedContexts.get(pluginId)?.onDisable?.();
    clearPluginExtensionsForPlugin(pluginId);
    loadedContexts.delete(pluginId);
    loadedPluginIds.delete(pluginId);
  }

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || plugin.manifestError) continue;
    if (loadedPluginIds.has(plugin.id)) continue;

    const url = await window.electronAPI.pluginsGetModuleUrl(plugin.id);
    if (!url) continue;

    try {
      const mod = await importPluginModule(url);
      const context = createPluginRegisterContext(plugin.id);
      if (typeof mod.register === 'function') {
        await mod.register(context);
      }
      context.onEnable?.();
      loadedContexts.set(plugin.id, context);
      loadedPluginIds.add(plugin.id);
      if (!previousEnabled.has(plugin.id)) {
        context.log('loaded');
      }
    } catch (error) {
      console.warn(`[plugins] Failed to load ${plugin.id}:`, error);
    }
  }
}
