import {
  applyNobleTitleForSelection,
  applyPersonWrapperForSelection,
} from '../../autoTagging/nobleTitleSpanEditorAdapter';
import { applyGroupAndClean } from '../../autoTagging/groupAndCleanEditorAdapter';
import type { PluginRegisterContext } from '../registerContext';

/**
 * Registers Norbert tagging helpers.
 *  - Add-tag palette: "Tag noble title" and "Tag person wrapper"
 *    (see nobleTitleSpanEditorApply.ts / nobleTitleSpanEditorAdapter.ts).
 *  - Toolbar: "Group and clean" post-validation cleanup
 *    (see groupAndCleanEditorAdapter.ts).
 */
export function registerNorbertNobleTitleUi(context: PluginRegisterContext): void {
  context.log('registering noble-title span tagging UI');

  context.registerToolbarItem({
    id: 'norbert-menu',
    icon: 'norbertMenu',
    title: 'Norbert',
    tooltip: 'Norbert tools',
    group: 'ui',
    isAvailable: () => true,
    menuItems: [
      {
        id: 'group-and-clean',
        label: 'Group and clean',
        onClick: () => void applyGroupAndClean(),
      },
    ],
  });

  context.registerTagCommandItem({
    id: 'noble-title',
    label: 'Tag noble title',
    icon: 'norbert',
    schemaTag: 'nobleTitle',
    onClick: () => applyNobleTitleForSelection(),
  });
  context.registerTagCommandItem({
    id: 'person-wrapper',
    label: 'Tag person wrapper',
    icon: 'norbert',
    onClick: () => applyPersonWrapperForSelection(),
  });
}
