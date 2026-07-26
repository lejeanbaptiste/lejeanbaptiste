/** Which document(s) a tag bomb run scans for untagged matches. */
export type TagBombScope = 'currentFile' | 'openTabs' | 'project' | 'custom';

export const TAG_BOMB_SCOPES: TagBombScope[] = ['currentFile', 'openTabs', 'project', 'custom'];

export const TAG_BOMB_SCOPE_LABEL_KEYS: Record<TagBombScope, string> = {
  currentFile: 'LW.autoTagging.tag_bomb_scope.current_document',
  openTabs: 'LW.autoTagging.tag_bomb_scope.open_tabs',
  project: 'LW.autoTagging.tag_bomb_scope.entire_corpus',
  custom: 'LW.autoTagging.tag_bomb_scope.select_folder',
};
