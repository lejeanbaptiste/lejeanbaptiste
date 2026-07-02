import type { OpenTab } from '@src/overmind/project/state';
import { isTranslationFile } from '../translationFileNaming';
import { collectXmlFiles } from './collectXmlFiles';
import {
  evaluateXPathAll,
  getNodeLabel,
  getXPathForElement,
  parseXmlDocument,
} from './evaluateXPathAll';
import type { XPathFileResult, XPathScope } from './types';

/** XPath only makes sense against schema-validated documents — translation companion files
 * (chapter1.fr.translation.xml) are a separate, unvalidated structure and are never targets. */
const excludeTranslationFiles = (filePaths: string[]): string[] =>
  filePaths.filter((filePath) => !isTranslationFile(filePath));

const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

/** Raw XML content for search — always the on-disk / tab snapshot, not the editor DOM. */
const getContentForSearch = (tab: OpenTab, activeTabPath: string | null) => {
  if (isSourceEditorMode() && tab.filePath === activeTabPath) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent || tab.content;
  }
  return tab.content;
};

const buildMatchesFromNodes = (
  filePath: string,
  nodes: Node[],
  getXpath: (node: Node) => string,
) => {
  const matches = nodes.map((node, resultIndex) => ({
    resultIndex,
    label: getNodeLabel(node),
    xpath: getXpath(node),
  }));

  if (matches.length === 0) return null;

  return {
    filePath,
    filename: getFilename(filePath),
    matches,
  } satisfies XPathFileResult;
};

/** The visual editor strips the teiHeader before loading, so header nodes can't be jumped to
 * in WYSIWYG mode — and the jump logic would mis-map them onto body elements instead. */
const isInsideHeader = (node: Node): boolean => {
  let current: Node | null = node;
  while (current) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as Element).localName === 'teiHeader'
    ) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
};

const searchInXmlContent = (filePath: string, content: string, query: string) => {
  const doc = parseXmlDocument(content);
  if (!doc) return null;

  let nodes = evaluateXPathAll(doc, query);
  // In Source mode the header is visible and navigable, so header hits stay.
  if (!isSourceEditorMode()) {
    nodes = nodes.filter((node) => !isInsideHeader(node));
  }
  return buildMatchesFromNodes(filePath, nodes, (node) => getXPathForElement(node, doc));
};

export interface SearchXPathParams {
  activeTabPath: string | null;
  customPath?: string;
  openTabs: OpenTab[];
  query: string;
  rootPath: string | null;
  scope: XPathScope;
}

export interface SearchXPathResult {
  error?: string;
  results: XPathFileResult[];
}

export const searchXPath = async ({
  activeTabPath,
  customPath,
  openTabs,
  query,
  rootPath,
  scope,
}: SearchXPathParams): Promise<SearchXPathResult> => {
  const trimmed = query.trim();
  if (!trimmed) return { results: [] };

  if (!window.electronAPI) {
    return { results: [], error: 'Desktop file access is unavailable.' };
  }

  const results: XPathFileResult[] = [];

  const addResult = (result: XPathFileResult | null) => {
    if (result) results.push(result);
  };

  if (scope === 'currentFile') {
    if (!activeTabPath) {
      return { results: [], error: 'No file is open.' };
    }
    if (isTranslationFile(activeTabPath)) {
      return { results: [], error: 'XPath does not apply to translation files.' };
    }

    const tab = openTabs.find((item) => item.filePath === activeTabPath);
    if (!tab) {
      return { results: [], error: 'No file is open.' };
    }

    addResult(searchInXmlContent(activeTabPath, getContentForSearch(tab, activeTabPath), trimmed));
    return { results };
  }

  if (scope === 'openTabs') {
    if (openTabs.length === 0) {
      return { results: [], error: 'No files are open.' };
    }

    for (const tab of openTabs) {
      if (isTranslationFile(tab.filePath)) continue;
      addResult(
        searchInXmlContent(tab.filePath, getContentForSearch(tab, activeTabPath), trimmed),
      );
    }

    return { results };
  }

  if (scope === 'project') {
    if (!rootPath) {
      return { results: [], error: 'Open a project folder first.' };
    }

    const filePaths = excludeTranslationFiles(await collectXmlFiles(rootPath));
    for (const filePath of filePaths) {
      const content = await window.electronAPI.readFile(filePath);
      addResult(searchInXmlContent(filePath, content, trimmed));
    }

    return { results };
  }

  if (scope === 'custom') {
    const folderPath = customPath?.trim();
    if (!folderPath) {
      return { results: [], error: 'Enter a folder path.' };
    }

    try {
      await window.electronAPI.readDirectory(folderPath, { allFiles: true });
    } catch {
      return { results: [], error: 'Folder path is not accessible.' };
    }

    const filePaths = excludeTranslationFiles(await collectXmlFiles(folderPath));
    for (const filePath of filePaths) {
      const content = await window.electronAPI.readFile(filePath);
      addResult(searchInXmlContent(filePath, content, trimmed));
    }

    return { results };
  }

  return { results: [] };
};
