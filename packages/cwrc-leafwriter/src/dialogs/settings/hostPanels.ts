import type { ComponentType } from 'react';

/**
 * Settings panels whose implementation lives in the host app rather than in this
 * package.
 *
 * The project-metadata form is owned by `apps/commons` (it is desktop-only and
 * built on commons' own project-file plumbing), but it is presented inside this
 * package's settings dialog. Importing it directly would invert the dependency —
 * a published package reaching up into the app — which additionally dragged
 * commons' whole project-metadata subtree into this package's `tsc` program,
 * where commons' `@src/*` alias does not resolve and its `Window.electronAPI`
 * augmentation is not in scope. That produced a batch of errors that were real
 * under commons' tsconfig and meaningless under this one.
 *
 * The host registers its panel at startup instead; this package only renders
 * whatever is there. Registration happens at module-init time in commons, long
 * before the settings dialog can be opened, so a nulled slot means "the host
 * does not provide this panel" rather than "not yet loaded".
 *
 * Mirrors the register/get shape used by `plugins/pluginExtensions.ts`.
 */
export type HostSettingsPanel = ComponentType<{ active?: boolean }>;

let projectSettingsPanel: HostSettingsPanel | null = null;

export function registerProjectSettingsPanel(component: HostSettingsPanel): void {
  projectSettingsPanel = component;
}

export function getProjectSettingsPanel(): HostSettingsPanel | null {
  return projectSettingsPanel;
}

/** Test helper — drops the host registration so suites do not leak into each other. */
export function clearHostSettingsPanels(): void {
  projectSettingsPanel = null;
}
