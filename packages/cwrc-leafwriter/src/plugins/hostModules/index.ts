import type { PluginRegisterContext } from '../registerContext';

export type PluginHostModule = {
  registerCjkDatesUi?: (context: PluginRegisterContext) => void;
};

const loaders: Record<string, () => Promise<PluginHostModule>> = {
  'cjk-dates-ui': () => import('./cjkDatesUi'),
};

export async function loadPluginHostModule(moduleId: string): Promise<PluginHostModule> {
  const load = loaders[moduleId];
  if (!load) {
    throw new Error(`Unknown plugin host module: ${moduleId}`);
  }
  return load();
}
