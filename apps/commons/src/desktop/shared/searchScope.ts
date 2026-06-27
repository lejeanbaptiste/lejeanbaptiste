export type SearchScope = 'currentFile' | 'openTabs' | 'project' | 'custom';

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  currentFile: 'Current file',
  openTabs: 'Open tabs',
  project: 'Project',
  custom: 'Custom',
};
