import { clearPluginExtensionsForPlugin } from './pluginExtensions';
import { clearPluginToolActionsForPlugin } from './toolActions';
import { recoverFromChunkLoadFailure } from './chunkLoadRecovery';
import { createPluginRegisterContext } from './registerContext';
import type { PluginHostSnapshotView } from './types';

const loadedPluginIds = new Set<string>();
const loadedContexts = new Map<string, ReturnType<typeof createPluginRegisterContext>>();

async function importPluginModule(
  url: string,
): Promise<{ register?: (ctx: unknown) => void | Promise<void> }> {
  return import(/* webpackIgnore: true */ url);
}

export async function loadEnabledPluginModules(
  snapshot: PluginHostSnapshotView | null,
  previousEnabled = new Set<string>(),
): Promise<void> {
  if (!snapshot || !window.electronAPI?.pluginsGetModuleUrl) return;

  const enabledNow = new Set(snapshot.state.enabled);

  for (const pluginId of loadedPluginIds) {
    if (enabledNow.has(pluginId)) continue;
    loadedContexts.get(pluginId)?.onDisable?.();
    clearPluginExtensionsForPlugin(pluginId);
    clearPluginToolActionsForPlugin(pluginId);
    loadedContexts.delete(pluginId);
    loadedPluginIds.delete(pluginId);
  }

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || plugin.manifestError) continue;
    if (loadedPluginIds.has(plugin.id)) continue;

    // Claim the slot before any await: concurrent calls to this function (e.g. two
    // refreshPluginRegistry snapshots landing back-to-back) must not both pass the
    // check above and double-register the same plugin's toolbar items/dialogs.
    loadedPluginIds.add(plugin.id);

    const url = await window.electronAPI.pluginsGetModuleUrl(plugin.id);
    if (!url) {
      loadedPluginIds.delete(plugin.id);
      continue;
    }

    try {
      const mod = await importPluginModule(url);
      const context = createPluginRegisterContext(plugin.id);
      if (typeof mod.register === 'function') {
        await mod.register(context);
      }
      context.onEnable?.();
      loadedContexts.set(plugin.id, context);
      if (!previousEnabled.has(plugin.id)) {
        context.log('loaded');
      }
    } catch (error) {
      loadedPluginIds.delete(plugin.id);
      clearPluginExtensionsForPlugin(plugin.id);
      clearPluginToolActionsForPlugin(plugin.id);
      // This error is normally caught here for per-plugin resilience, so it
      // never reaches the application's global unhandled-rejection handler.
      // A stale dev-server lazy chunk needs one full-page retry instead.
      recoverFromChunkLoadFailure(error);
      console.warn(`[plugins] Failed to load ${plugin.id}:`, error);
    }
  }
}
