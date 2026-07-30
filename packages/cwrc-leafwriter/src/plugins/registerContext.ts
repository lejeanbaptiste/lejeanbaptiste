import {
  registerPluginDialog,
  registerPluginReviewPanel,
  registerPluginToolbarItem,
  type PluginDialogComponent,
  type PluginReviewPanelMatcher,
  type PluginReviewPanelComponent,
  type PluginToolbarMenuItem,
} from './pluginExtensions';
import { loadPluginHostModule } from './hostModules';
import {
  registerPluginPersonNameSegmenter,
  type PluginPersonNameSegmentInput,
  type PluginPersonNameSegmentResult,
} from './personNameSegmenters';
import { registerPluginToolAction, type PluginToolActionHandler } from './toolActions';
import {
  registerPluginOfficeRelationExtractor,
  type PluginOfficeRelationExtractor,
} from './officeRelationExtractors';
import { registerPluginEntityDataExtractor } from './entityDataExtractors';
import {
  registerPluginPatternTagProducer,
  type PluginPatternTagProducer,
} from './patternTagProducers';

export interface PluginRegisterContext {
  pluginId: string;
  log: (message: string) => void;
  registerToolAction: (action: string, handler: PluginToolActionHandler) => void;
  registerDialog: (type: string, component: PluginDialogComponent) => void;
  registerReviewPanel: (
    matcher: PluginReviewPanelMatcher,
    component: PluginReviewPanelComponent,
    options?: {
      finishWhenIdle?:
        boolean | ((suggestions: import('../autoTagging/types').Suggestion[]) => boolean);
    },
  ) => void;
  registerToolbarItem: (item: {
    id: string;
    icon: string;
    title: string;
    tooltip?: string;
    group?: 'action' | 'ui' | 'panel' | 'general';
    isAvailable: () => boolean;
    /** Provide this for a single-action button, or `menuItems` for a dropdown. */
    onClick?: (ctx: { openCalendar: (notice?: string) => void }) => void;
    /** When present, the toolbar button opens a dropdown of these instead of calling `onClick`. */
    menuItems?: PluginToolbarMenuItem[];
  }) => void;
  /** Load UI modules bundled with LJB (webpack). Used by plugins that delegate UI to the host. */
  loadHostModule: (moduleId: string) => Promise<import('./hostModules').PluginHostModule>;
  /** Split a Chinese person name into family + given (e.g. Norbert surname table). */
  registerPersonNameSegmenter: (
    segmenter: (input: PluginPersonNameSegmentInput) => PluginPersonNameSegmentResult | null,
  ) => void;
  /** Infer a hierarchy edge from two adjacent, resolved office matches. */
  registerOfficeRelationExtractor: (extractor: PluginOfficeRelationExtractor) => void;
  registerEntityDataExtractor: (
    extractor: import('./entityDataExtractors').PluginEntityDataExtractor,
  ) => void;
  /** Supply wrapper-shaped candidates for the compound person-wrapper pass ("pattern-tag" contributions). */
  registerPatternTagProducer: (producer: PluginPatternTagProducer) => void;
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
    registerPersonNameSegmenter: (segmenter) => {
      registerPluginPersonNameSegmenter(pluginId, segmenter);
    },
    registerOfficeRelationExtractor: (extractor) => {
      registerPluginOfficeRelationExtractor(pluginId, extractor);
    },
    registerEntityDataExtractor: (extractor) => {
      registerPluginEntityDataExtractor(pluginId, extractor);
    },
    registerPatternTagProducer: (producer) => {
      registerPluginPatternTagProducer(pluginId, producer);
    },
  };
  return context;
}
