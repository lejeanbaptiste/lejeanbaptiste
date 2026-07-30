import type { ComponentType } from 'react';
import { clearPluginPersonNameSegmentersForPlugin, clearAllPluginPersonNameSegmenters } from './personNameSegmenters';
import type { DecisionEvent } from '../autoTagging/reviewController';
import type { Suggestion } from '../autoTagging/types';
import type { IDialog } from '../dialogs/type';
import {
  clearAllPluginOfficeRelationExtractors,
  clearPluginOfficeRelationExtractor,
} from './officeRelationExtractors';

export type PluginDialogComponent = ComponentType<IDialog>;

export type PluginReviewPanelComponent = ComponentType<{
  autoFocus?: boolean;
  busy?: boolean;
  finishWhenIdle?: boolean;
  suggestions: Suggestion[];
  onApply: (accepted: Suggestion[]) => void;
  onFocus?: (suggestion: Suggestion) => void;
  onDecision?: (event: DecisionEvent) => void;
  onClose?: () => void;
}>;

export type PluginReviewPanelMatcher = (suggestions: Suggestion[]) => boolean;

export interface PluginToolbarMenuItem {
  id: string;
  label: string;
  onClick: (ctx: { openCalendar: (notice?: string) => void }) => void;
  disabled?: boolean;
  tooltip?: string;
}

export interface PluginToolbarContribution {
  pluginId: string;
  id: string;
  icon: string;
  title: string;
  tooltip?: string;
  group?: 'action' | 'ui' | 'panel' | 'general';
  /** When true, show the toolbar button. Called on render. */
  isAvailable: () => boolean;
  /**
   * A single-item contribution calls this directly. Omit it (and supply
   * `menuItems` instead) to render a dropdown of several actions under one
   * toolbar button.
   */
  onClick?: (ctx: { openCalendar: (notice?: string) => void }) => void;
  /** When present, the toolbar button opens a dropdown of these instead of calling `onClick`. */
  menuItems?: PluginToolbarMenuItem[];
}

const pluginDialogs = new Map<string, PluginDialogComponent>();
const pluginReviewPanels: Array<{
  pluginId: string;
  matcher: PluginReviewPanelMatcher;
  component: PluginReviewPanelComponent;
  finishWhenIdle?: boolean | ((suggestions: Suggestion[]) => boolean);
}> = [];
const pluginToolbarItems: PluginToolbarContribution[] = [];

export function registerPluginDialog(type: string, component: PluginDialogComponent): void {
  pluginDialogs.set(type, component);
}

export function getPluginDialog(type: string): PluginDialogComponent | undefined {
  return pluginDialogs.get(type);
}

export function registerPluginReviewPanel(
  pluginId: string,
  matcher: PluginReviewPanelMatcher,
  component: PluginReviewPanelComponent,
  options?: { finishWhenIdle?: boolean | ((suggestions: Suggestion[]) => boolean) },
): void {
  pluginReviewPanels.push({
    pluginId,
    matcher,
    component,
    finishWhenIdle: options?.finishWhenIdle,
  });
}

export function findPluginReviewPanel(suggestions: Suggestion[]): {
  component: PluginReviewPanelComponent;
  finishWhenIdle: boolean;
} | null {
  for (const panel of pluginReviewPanels) {
    if (panel.matcher(suggestions)) {
      const finishWhenIdle =
        typeof panel.finishWhenIdle === 'function'
          ? panel.finishWhenIdle(suggestions)
          : (panel.finishWhenIdle ?? false);
      return { component: panel.component, finishWhenIdle };
    }
  }
  return null;
}

export function registerPluginToolbarItem(item: PluginToolbarContribution): void {
  pluginToolbarItems.push(item);
}

export function getPluginToolbarItems(): PluginToolbarContribution[] {
  return pluginToolbarItems;
}

export function clearPluginExtensionsForPlugin(pluginId: string): void {
  for (const [type, component] of pluginDialogs.entries()) {
    if ((component as { __pluginId?: string }).__pluginId === pluginId) {
      pluginDialogs.delete(type);
    }
  }
  for (let i = pluginReviewPanels.length - 1; i >= 0; i -= 1) {
    if (pluginReviewPanels[i]?.pluginId === pluginId) pluginReviewPanels.splice(i, 1);
  }
  for (let i = pluginToolbarItems.length - 1; i >= 0; i -= 1) {
    if (pluginToolbarItems[i]?.pluginId === pluginId) pluginToolbarItems.splice(i, 1);
  }
  clearPluginPersonNameSegmentersForPlugin(pluginId);
  clearPluginOfficeRelationExtractor(pluginId);
}

export function clearAllPluginExtensions(): void {
  pluginDialogs.clear();
  pluginReviewPanels.length = 0;
  pluginToolbarItems.length = 0;
  clearAllPluginPersonNameSegmenters();
  clearAllPluginOfficeRelationExtractors();
}
