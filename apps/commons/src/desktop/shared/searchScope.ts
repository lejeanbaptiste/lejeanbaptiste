export type SearchScope = 'currentFile' | 'openTabs' | 'project' | 'custom';

export const SEARCH_SCOPE_LABEL_KEYS: Record<SearchScope, string> = {
  currentFile: 'LWC.desktop.shared.search_scope.current_file',
  openTabs: 'LWC.desktop.shared.search_scope.open_tabs',
  project: 'LWC.desktop.shared.search_scope.project',
  custom: 'LWC.desktop.shared.search_scope.custom',
};
