import { Editor } from 'tinymce/tinymce';

import { getSvg } from '../../utilities/icons';

//https://stackoverflow.com/questions/44717164/unable-to-import-svg-files-in-typescript

export const addIconPack = (editor: Editor) => {
  editor.ui.registry.addIcon('tags', getSvg('tags'));
  editor.ui.registry.addIcon('person', getSvg('person'));
  editor.ui.registry.addIcon('place', getSvg('place'));
  editor.ui.registry.addIcon('title', getSvg('title'));
  editor.ui.registry.addIcon('date', getSvg('date'));
  editor.ui.registry.addIcon('organization', getSvg('organization'));
  editor.ui.registry.addIcon('citation', getSvg('citation'));
  editor.ui.registry.addIcon('note', getSvg('note'));
  editor.ui.registry.addIcon('correction', getSvg('correction'));
  editor.ui.registry.addIcon('keyword', getSvg('keyword'));
  editor.ui.registry.addIcon('link', getSvg('link'));
  editor.ui.registry.addIcon('rs', getSvg('rs'));
  editor.ui.registry.addIcon('translation', getSvg('translation'));
  editor.ui.registry.addIcon('relation', getSvg('relation'));
  editor.ui.registry.addIcon('tag-edit', getSvg('tag-edit'));
  editor.ui.registry.addIcon('tag-remove', getSvg('tag-remove'));
  editor.ui.registry.addIcon('code', getSvg('code'));
  editor.ui.registry.addIcon('markup-file', getSvg('markup-file'));
  editor.ui.registry.addIcon('edit', getSvg('edit'));
  editor.ui.registry.addIcon('validate', getSvg('validate'));
  editor.ui.registry.addIcon('save', getSvg('save'));
  editor.ui.registry.addIcon('load', getSvg('load'));
  editor.ui.registry.addIcon('sign-out', getSvg('sign-out'));
};
