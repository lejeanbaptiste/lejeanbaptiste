import type { OpenTab } from '@src/overmind/project/state';
import { collectXmlFiles } from './collectXmlFiles';
import {
  evaluateXPathAll,
  getNodeId,
  getNodeLabel,
  getXPathForElement,
  parseXmlDocument,
} from './evaluateXPathAll';
import type { XPathFileResult, XPathScope } from './types';

const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() ?? filePath;

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

const getContentForSearch = (tab: OpenTab, activeTabPath: string | null) => {
  if (isSourceEditorMode() && tab.filePath === activeTabPath) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent || tab.content;
  }
  return tab.content;
};

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

const canUseEditor = (filePath: string, editorFilePath: string | null) =>
  editorFilePath === filePath && !!window.writer?.editor && !isSourceEditorMode();

const buildMatchesFromNodes = (
  filePath: string,
  nodes: Node[],
  getXpath: (node: Node) => string,
  includeIds = false,
) => {
  const matches = nodes.map((node, matchIndex) => ({
    matchIndex,
    id: includeIds ? getNodeId(node) : undefined,
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

const searchInXmlContent = (filePath: string, content: string, query: string) => {
  const doc = parseXmlDocument(content);
  if (!doc) return null;

  const nodes = evaluateXPathAll(doc, query);
  return buildMatchesFromNodes(filePath, nodes, (node) => getXPathForElement(node, doc));
};

const searchInEditor = (filePath: string, query: string) => {
  if (!window.writer?.editor) return null;

  const nodes = window.writer.utilities.evaluateXPathAll(window.writer.editor.getBody(), query);
  return buildMatchesFromNodes(
    filePath,
    nodes,
    (node) => {
      if (isElement(node)) {
        return window.writer.utilities.getElementXPath(node) ?? '';
      }
      return window.writer.utilities.getNodeXpath(node) ?? '';
    },
    true,
  );
};

export interface SearchXPathParams {
  activeTabPath: string | null;
  customPath?: string;
  editorFilePath: string | null;
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
  editorFilePath,
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

    const tab = openTabs.find((item) => item.filePath === activeTabPath);
    if (!tab) {
      return { results: [], error: 'No file is open.' };
    }

    const canUseEditorDom = canUseEditor(activeTabPath, editorFilePath);
    addResult(
      canUseEditorDom
        ? searchInEditor(activeTabPath, trimmed)
        : searchInXmlContent(activeTabPath, getContentForSearch(tab, activeTabPath), trimmed),
    );

    return { results };
  }

  if (scope === 'openTabs') {
    if (openTabs.length === 0) {
      return { results: [], error: 'No files are open.' };
    }

    for (const tab of openTabs) {
      const canUseEditorDom = canUseEditor(tab.filePath, editorFilePath);
      addResult(
        canUseEditorDom
          ? searchInEditor(tab.filePath, trimmed)
          : searchInXmlContent(tab.filePath, getContentForSearch(tab, activeTabPath), trimmed),
      );
    }

    return { results };
  }

  if (scope === 'project') {
    if (!rootPath) {
      return { results: [], error: 'Open a project folder first.' };
    }

    const filePaths = await collectXmlFiles(rootPath);
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

    const filePaths = await collectXmlFiles(folderPath);
    for (const filePath of filePaths) {
      const content = await window.electronAPI.readFile(filePath);
      addResult(searchInXmlContent(filePath, content, trimmed));
    }

    return { results };
  }

  return { results: [] };
};
