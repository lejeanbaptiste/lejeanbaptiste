import {
  applyNobleTitleForSelection,
  applyPersonWrapperForSelection,
} from '../../autoTagging/nobleTitleSpanEditorAdapter';
import { applyGroupAndClean } from '../../autoTagging/groupAndCleanEditorAdapter';
import type { PluginRegisterContext } from '../registerContext';

/**
 * Registers the Norbert toolbar menu, at the end of the central toolbar.
 * Two actions:
 *  - "Tag noble title": tag the selection as a noble title (fief/rank/
 *    posthumous name, plus a person wrapper if a trailing name is
 *    included). See nobleTitleSpanEditorApply.ts for how this commits to
 *    the live TinyMCE-controlled document via `tagger.addStructureTag`.
 *  - "Group and clean": a post-validation cleanup pass over already-tagged
 *    markup (merge compound roleNames, nest placeNames into their roleName,
 *    parse childless nobleTitles, create/key person wrappers). See
 *    groupAndCleanEditorAdapter.ts.
 */
export function registerNorbertNobleTitleUi(context: PluginRegisterContext): void {
  context.log('registering noble-title span tagging UI');

  context.registerToolbarItem({
    id: 'norbert-menu',
    icon: 'entitiesTag',
    title: 'Norbert',
    tooltip: 'Norbert noble-title tools',
    group: 'ui',
    isAvailable: () => true,
    menuItems: [
      {
        id: 'tag-noble-title',
        label: 'Tag noble title',
        onClick: () => void applyNobleTitleForSelection(),
      },
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
