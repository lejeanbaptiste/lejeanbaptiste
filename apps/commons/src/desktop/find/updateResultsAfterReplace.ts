import { offsetToLineColumn, searchInContent } from './textSearchUtils';
import { filterHitsForWysiwygEditor } from './wysiwygVisibleHits';
import type { FindFileResult } from './types';

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

/** Adjust one file's match list after a single replace without re-scanning the whole file. */
const updateFileMatchesAfterReplace = (
  fileResult: FindFileResult,
  removedStart: number,
  removedEnd: number,
  replacementLength: number,
  fileContent: string,
): FindFileResult | null => {
  const removedIndex = fileResult.matches.findIndex(
    (match) => match.start === removedStart && match.end === removedEnd,
  );
  if (removedIndex < 0) return null;

  const delta = replacementLength - (removedEnd - removedStart);

  const matches = fileResult.matches
    .filter((_, index) => index !== removedIndex)
    .map((match, matchIndex) => {
      if (match.start <= removedStart) {
        return { ...match, matchIndex };
      }

      const start = match.start + delta;
      const end = match.end + delta;
      const { line, column } = offsetToLineColumn(fileContent, start);

      return {
        ...match,
        start,
        end,
        line,
        column,
        matchIndex,
      };
    });

  if (matches.length === 0) return null;

  return { ...fileResult, matches };
};

/** Merge an updated file into existing results (preserves file order). Falls back to re-search. */
export const updateResultsAfterSingleReplace = (
  results: FindFileResult[],
  filePath: string,
  fileContent: string,
  query: string,
  useRegex: boolean,
  ignoreCase = false,
  replacedHit?: { end: number; start: number; replacementLength: number },
): { results: FindFileResult[]; totalMatches: number } => {
  if (replacedHit) {
    const incremental = results
      .map((fileResult) => {
        if (fileResult.filePath !== filePath) return fileResult;

        const updated = updateFileMatchesAfterReplace(
          fileResult,
          replacedHit.start,
          replacedHit.end,
          replacedHit.replacementLength,
          fileContent,
        );
        return updated;
      })
      .filter((fileResult): fileResult is FindFileResult => fileResult !== null);

    if (incremental.some((fileResult) => fileResult.filePath === filePath)) {
      return {
        results: incremental,
        totalMatches: incremental.reduce((sum, file) => sum + file.matches.length, 0),
      };
    }
  }

  let matches = searchInContent(fileContent, query, useRegex, ignoreCase);
  if (!isSourceEditorMode()) {
    matches = filterHitsForWysiwygEditor(fileContent, matches);
  }

  const nextResults = results
    .map((fileResult) => {
      if (fileResult.filePath !== filePath) return fileResult;
      if (matches.length === 0) return null;
      return { ...fileResult, matches };
    })
    .filter((fileResult): fileResult is FindFileResult => fileResult !== null);

  return {
    results: nextResults,
    totalMatches: nextResults.reduce((sum, file) => sum + file.matches.length, 0),
  };
};
