import { useLeafWriter } from '@src/hooks/useLeafWriter';
import { useActions, useAppState } from '@src/overmind';
import { useCallback } from 'react';
import {
  getContentForReplace,
  isFileOpenInTabs,
  readFileContentForReplace,
  resolveTextHitInXml,
  syncReplacedContent,
  writeReplacedContentToDisk,
} from './applyReplaceToEditor';
import { validateAndReplaceAll, validateAndReplaceHit } from './replaceValidation';
import { searchText } from './searchText';
import type { FindFileResult } from './types';
import { updateResultsAfterSingleReplace } from './updateResultsAfterReplace';
import type { SearchScope } from '../shared/searchScope';

export interface FlatReplaceHit {
  end: number;
  filePath: string;
  replaceable?: boolean;
  start: number;
}

export interface UseFindReplaceParams {
  activeTabPath: string | null;
  customPath: string;
  findQuery: string;
  onSearchComplete: (params: {
    contentForJump?: string;
    results: FindFileResult[];
    totalMatches: number;
    error?: string | null;
    refreshHighlight?: boolean;
    selectedIndex?: number;
    jumpToSelection?: boolean;
  }) => void;
  openTabs: { content: string; filePath: string }[];
  replaceQuery: string;
  results: FindFileResult[];
  rootPath: string | null;
  scope: SearchScope;
  selectedHit: FlatReplaceHit | null;
  selectedIndex: number;
  useRegex: boolean;
}

export const useFindReplace = ({
  activeTabPath,
  customPath,
  findQuery,
  onSearchComplete,
  openTabs,
  replaceQuery,
  results,
  rootPath,
  scope,
  selectedHit,
  selectedIndex,
  useRegex,
}: UseFindReplaceParams) => {
  const { resource } = useAppState().editor;
  const { markTabDirty, updateTabContent } = useActions().project;
  const { notifyViaSnackbar } = useActions().ui;
  const { loadDocumentInWriter } = useLeafWriter();

  const loadFileContent = useCallback(
    async (filePath: string): Promise<string | null> => {
      const fromMemory = getContentForReplace(
        filePath,
        openTabs,
        activeTabPath,
        resource?.filePath,
      );
      if (fromMemory !== undefined) return fromMemory;

      return readFileContentForReplace(filePath);
    },
    [activeTabPath, openTabs, resource?.filePath],
  );

  const rerunSearch = useCallback(
    async (options?: { jumpToSelection?: boolean; selectedIndex?: number }) => {
      const {
        results: nextResults,
        totalMatches,
        error,
      } = await searchText({
        activeTabPath,
        customPath,
        openTabs,
        query: findQuery,
        rootPath,
        scope,
        useRegex,
      });

      onSearchComplete({
        results: nextResults,
        totalMatches,
        error: error ?? (totalMatches === 0 ? 'No results.' : null),
        selectedIndex: options?.selectedIndex,
        jumpToSelection: options?.jumpToSelection,
      });
    },
    [
      activeTabPath,
      customPath,
      findQuery,
      onSearchComplete,
      openTabs,
      rootPath,
      scope,
      useRegex,
    ],
  );

  const replaceCurrentHit = useCallback(async () => {
    if (!selectedHit || !findQuery.trim()) return;

    const content = await loadFileContent(selectedHit.filePath);
    if (content === null) {
      notifyViaSnackbar('Could not read file for replace.');
      return;
    }

    const resolvedHit = resolveTextHitInXml(content, selectedHit.start, selectedHit.end);

    const outcome = validateAndReplaceHit(
      content,
      selectedHit.start,
      selectedHit.end,
      replaceQuery,
      useRegex,
      findQuery.trim(),
    );

    if (!outcome.ok || !outcome.content) {
      notifyViaSnackbar(outcome.error ?? 'Replace failed.');
      return;
    }

    const isOpen = isFileOpenInTabs(selectedHit.filePath, openTabs);

    if (isOpen) {
      await syncReplacedContent({
        activeTabPath,
        content: outcome.content,
        filePath: selectedHit.filePath,
        loadDocumentInWriter,
        markTabDirty,
        resourceFilePath: resource?.filePath,
        updateTabContent,
        sourcePatch:
          outcome.replacementUsed !== undefined
            ? {
                contentBefore: content,
                end: selectedHit.end,
                replacement: outcome.replacementUsed,
                start: selectedHit.start,
              }
            : undefined,
        visualPatch:
          resolvedHit && outcome.replacementUsed !== undefined
            ? { resolved: resolvedHit, replacement: outcome.replacementUsed }
            : undefined,
      });
    } else {
      const written = await writeReplacedContentToDisk(selectedHit.filePath, outcome.content);
      if (!written) {
        notifyViaSnackbar('Failed to write file.');
        return;
      }
    }

    const { results: nextResults, totalMatches } = updateResultsAfterSingleReplace(
      results,
      selectedHit.filePath,
      outcome.content,
      findQuery.trim(),
      useRegex,
      {
        end: selectedHit.end,
        replacementLength: outcome.replacementUsed.length,
        start: selectedHit.start,
      },
    );

    const flatCount = nextResults.reduce((n, r) => n + r.matches.length, 0);
    const nextIndex = flatCount === 0 ? -1 : Math.min(selectedIndex, flatCount - 1);

    onSearchComplete({
      contentForJump: outcome.content,
      results: nextResults,
      totalMatches,
      error: totalMatches === 0 ? 'No results.' : null,
      refreshHighlight: totalMatches > 0,
      jumpToSelection: totalMatches > 0,
      selectedIndex: nextIndex,
    });
  }, [
    activeTabPath,
    findQuery,
    loadDocumentInWriter,
    loadFileContent,
    markTabDirty,
    notifyViaSnackbar,
    onSearchComplete,
    replaceQuery,
    resource?.filePath,
    results,
    scope,
    selectedHit,
    selectedIndex,
    openTabs,
    updateTabContent,
    useRegex,
  ]);

  const replaceAllInScope = useCallback(async () => {
    if (!findQuery.trim() || results.length === 0) return;

    let totalReplaced = 0;
    let filesModified = 0;
    let totalSkipped = 0;
    let filesFailed = 0;

    for (const fileResult of results) {
      const content = await loadFileContent(fileResult.filePath);
      if (content === null) {
        filesFailed += 1;
        continue;
      }

      const outcome = validateAndReplaceAll(
        content,
        findQuery.trim(),
        replaceQuery,
        useRegex,
      );

      if (!outcome.ok) {
        filesFailed += 1;
        continue;
      }

      totalSkipped += outcome.skippedNonReplaceable;

      if (outcome.count === 0 || !outcome.content || outcome.content === content) {
        continue;
      }

      const isOpen = isFileOpenInTabs(fileResult.filePath, openTabs);

      if (isOpen) {
        await syncReplacedContent({
          activeTabPath,
          content: outcome.content,
          filePath: fileResult.filePath,
          loadDocumentInWriter,
          markTabDirty,
          resourceFilePath: resource?.filePath,
          updateTabContent,
        });
      } else {
        const written = await writeReplacedContentToDisk(fileResult.filePath, outcome.content);
        if (!written) {
          filesFailed += 1;
          continue;
        }
      }

      totalReplaced += outcome.count;
      filesModified += 1;
    }

    if (filesFailed > 0) {
      notifyViaSnackbar(
        `Replaced ${totalReplaced} occurrence${totalReplaced === 1 ? '' : 's'} in ${filesModified} file${filesModified === 1 ? '' : 's'}. ${filesFailed} file${filesFailed === 1 ? '' : 's'} failed.`,
      );
    } else if (totalReplaced === 0) {
      notifyViaSnackbar(
        totalSkipped > 0
          ? `No replaceable matches. Skipped ${totalSkipped} hit${totalSkipped === 1 ? '' : 's'} that cross markup.`
          : 'No matches to replace.',
      );
    } else {
      const skippedPart =
        totalSkipped > 0
          ? ` Skipped ${totalSkipped} hit${totalSkipped === 1 ? '' : 's'} that cross markup.`
          : '';
      notifyViaSnackbar(
        `Replaced ${totalReplaced} occurrence${totalReplaced === 1 ? '' : 's'} in ${filesModified} file${filesModified === 1 ? '' : 's'}.${skippedPart}`,
      );
    }

    await rerunSearch({ jumpToSelection: true, selectedIndex: 0 });
  }, [
    activeTabPath,
    findQuery,
    loadDocumentInWriter,
    loadFileContent,
    markTabDirty,
    notifyViaSnackbar,
    openTabs,
    replaceQuery,
    rerunSearch,
    resource?.filePath,
    results,
    updateTabContent,
    useRegex,
  ]);

  return { replaceAllInScope, replaceCurrentHit };
};
