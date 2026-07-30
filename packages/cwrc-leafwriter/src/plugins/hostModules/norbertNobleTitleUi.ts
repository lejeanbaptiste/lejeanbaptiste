import { applyNobleTitleForSelection } from '../../autoTagging/nobleTitleSpanEditorAdapter';
import type { PluginRegisterContext } from '../registerContext';

/**
 * Registers the Norbert toolbar menu, at the end of the central toolbar.
 * Currently one action: tag the selection as a noble title (fief/rank/
 * posthumous name, plus a person wrapper if a trailing name is included).
 * See nobleTitleSpanEditorApply.ts for how this commits to the live
 * TinyMCE-controlled document via `tagger.addStructureTag`.
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
    ],
  });
}
