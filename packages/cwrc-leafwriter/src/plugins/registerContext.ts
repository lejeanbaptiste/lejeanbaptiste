import {
  registerPluginDialog,
  registerPluginReviewPanel,
  registerPluginToolbarItem,
  type PluginDialogComponent,
  type PluginReviewPanelMatcher,
  type PluginReviewPanelComponent,
} from './pluginExtensions';
import { loadPluginHostModule } from './hostModules';
import { registerPluginToolAction, type PluginToolActionHandler } from './toolActions';

export interface PluginRegisterContext {
  pluginId: string;
  log: (message: string) => void;
  registerToolAction: (action: string, handler: PluginToolActionHandler) => void;
  registerDialog: (type: string, component: PluginDialogComponent) => void;
  registerReviewPanel: (
    matcher: PluginReviewPanelMatcher,
    component: PluginReviewPanelComponent,
    options?: { finishWhenIdle?: boolean | ((suggestions: import('../autoTagging/types').Suggestion[]) => boolean) },
  ) => void;
  registerToolbarItem: (item: {
    id: string;
    icon: string;
    title: string;
    tooltip?: string;
    group?: 'action' | 'ui' | 'panel' | 'general';
    isAvailable: () => boolean;
    onClick: (ctx: { openCalendar: (notice?: string) => void }) => void;
  }) => void;
  /** Load UI modules bundled with LJB (webpack). Used by plugins that delegate UI to the host. */
  loadHostModule: (moduleId: string) => Promise<import('./hostModules').PluginHostModule>;
  onEnable?: () => void;
  onDisable?: () => void;
}

export type { PluginToolActionHandler };

export function createPluginRegisterContext(pluginId: string): PluginRegisterContext {
  const context: PluginRegisterContext = {
    pluginId,
    log: (message) => console.log(`[plugin:${pluginId}] ${message}`),
    registerToolAction: (action, handler) => registerPluginToolAction(action, handler),
    registerDialog: (type, component) => {
      (component as { __pluginId?: string }).__pluginId = pluginId;
      registerPluginDialog(type, component);
    },
    registerReviewPanel: (matcher, component, options) => {
      registerPluginReviewPanel(pluginId, matcher, component, options);
    },
    registerToolbarItem: (item) => {
      registerPluginToolbarItem({ pluginId, ...item });
    },
    loadHostModule: loadPluginHostModule,
  };
  return context;
}
