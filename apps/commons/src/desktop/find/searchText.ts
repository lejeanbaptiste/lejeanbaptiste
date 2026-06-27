import type { OpenTab } from '@src/overmind/project/state';
import { collectXmlFiles } from '../xpath/collectXmlFiles';
import type { SearchScope } from '../shared/searchScope';
import { filterHitsForWysiwygEditor } from './wysiwygVisibleHits';
import { searchInContent } from './textSearchUtils';
import type { FindFileResult } from './types';

const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

/** Live buffer for the active tab in Source mode; otherwise the tab snapshot. */
const getContentForSearch = (tab: OpenTab, activeTabPath: string | null) => {
  if (isSourceEditorMode() && tab.filePath === activeTabPath) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent || tab.content;
  }
  return tab.content;
};

const buildFileResult = (filePath: string, content: string, query: string, useRegex: boolean) => {
  let matches = searchInContent(content, query, useRegex);
  if (!isSourceEditorMode()) {
    matches = filterHitsForWysiwygEditor(content, matches);
  }
  if (matches.length === 0) return null;

  return {
    filePath,
    filename: getFilename(filePath),
    matches,
  } satisfies FindFileResult;
};

export interface SearchTextParams {
  activeTabPath: string | null;
  customPath?: string;
  openTabs: OpenTab[];
  query: string;
  rootPath: string | null;
  scope: SearchScope;
  useRegex: boolean;
}

export interface SearchTextResult {
  error?: string;
  results: FindFileResult[];
  totalMatches: number;
}

export const searchText = async ({
  activeTabPath,
  customPath,
  openTabs,
  query,
  rootPath,
  scope,
  useRegex,
}: SearchTextParams): Promise<SearchTextResult> => {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], totalMatches: 0 };

  if (!window.electronAPI) {
    return { results: [], totalMatches: 0, error: 'Desktop file access is unavailable.' };
  }

  if (useRegex) {
    try {
      new RegExp(trimmed, 'g');
    } catch (error) {
      return {
        results: [],
        totalMatches: 0,
        error: error instanceof Error ? error.message : 'Invalid regular expression.',
      };
    }
  }

  const results: FindFileResult[] = [];

  const addResult = (result: FindFileResult | null) => {
    if (result) results.push(result);
  };

  try {
    if (scope === 'currentFile') {
      if (!activeTabPath) {
        return { results: [], totalMatches: 0, error: 'No file is open.' };
      }

      const tab = openTabs.find((item) => item.filePath === activeTabPath);
      if (!tab) {
        return { results: [], totalMatches: 0, error: 'No file is open.' };
      }

      addResult(buildFileResult(activeTabPath, getContentForSearch(tab, activeTabPath), trimmed, useRegex));
    } else if (scope === 'openTabs') {
      if (openTabs.length === 0) {
        return { results: [], totalMatches: 0, error: 'No files are open.' };
      }

      for (const tab of openTabs) {
        addResult(buildFileResult(tab.filePath, getContentForSearch(tab, activeTabPath), trimmed, useRegex));
      }
    } else if (scope === 'project') {
      if (!rootPath) {
        return { results: [], totalMatches: 0, error: 'Open a project folder first.' };
      }

      const filePaths = await collectXmlFiles(rootPath);
      for (const filePath of filePaths) {
        const content = await window.electronAPI.readFile(filePath);
        addResult(buildFileResult(filePath, content, trimmed, useRegex));
      }
    } else if (scope === 'custom') {
      const folderPath = customPath?.trim();
      if (!folderPath) {
        return { results: [], totalMatches: 0, error: 'Enter a folder path.' };
      }

      try {
        await window.electronAPI.readDirectory(folderPath, { allFiles: true });
      } catch {
        return { results: [], totalMatches: 0, error: 'Folder path is not accessible.' };
      }

      const filePaths = await collectXmlFiles(folderPath);
      for (const filePath of filePaths) {
        const content = await window.electronAPI.readFile(filePath);
        addResult(buildFileResult(filePath, content, trimmed, useRegex));
      }
    }
  } catch (error) {
    return {
      results: [],
      totalMatches: 0,
      error: error instanceof Error ? error.message : 'Search failed.',
    };
  }

  const totalMatches = results.reduce((sum, file) => sum + file.matches.length, 0);

  return { results, totalMatches };
};
