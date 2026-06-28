import { useActions, useAppState } from '@src/overmind';
import type { NodeDetail } from '@cwrc/leafwriter-validator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_INSERT_TAG,
  matchesEditorLineBreak,
  matchesEditorRename,
  matchesEditorTagPopup,
  matchesTagPopupOpen,
  matchesTagPopupPropagate,
  matchesTagPopupQueueWalk,
  matchesWalkModeSkip,
  matchesWalkModeTag,
} from './keybindings';
import { applyTagFromPopup, type TagCommandMode } from './tagCommand';
import { insertLineBreak } from './tagInsert';
import {
  applyQueueWalkStepAt,
  applyRenameQueueWalkStepAt,
  countPropagatableMatches,
  countRenamableMatches,
  listRenamableElements,
  listUntaggedRanges,
  previewQueueWalkTarget,
  previewRenameWalkTarget,
  propagateRenameInFile,
  propagateTagInFile,
} from './tagPropagate';
import { clearTagWalkHighlight } from './tagWalkHighlight';
import {
  buildValidatorTarget,
  fetchTagSuggestions,
  filterTagSuggestions,
  getDefaultHighlightIndex,
  getEditorTagContext,
  pinParagraphInsertOption,
  sortTagSuggestions,
  withInsertModeFallbacks,
} from './tagSuggestions';
import { findParagraphAncestor } from './tagInsert';
import { getProjectTagCounts, loadTagStats, updateTagStatsForFile } from './tagStats';
import { getCaretScreenPosition } from './editorAnchor';

const LAST_USED_TAG_KEY = 'ljb:lastUsedTag';

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

const readLastUsedTag = (): string | null => {
  try {
    return sessionStorage.getItem(LAST_USED_TAG_KEY);
  } catch {
    return null;
  }
};

const writeLastUsedTag = (tagName: string) => {
  try {
    sessionStorage.setItem(LAST_USED_TAG_KEY, tagName);
  } catch {
    // ignore
  }
};

export interface WalkModeState {
  matchCount: number;
  mode: TagCommandMode;
  oldTagName?: string;
  search: string;
  tagName: string;
}

export const useTagCommandController = () => {
  const { rootPath, activeTabPath } = useAppState().project;
  const { notifyViaSnackbar } = useActions().ui;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TagCommandMode>('wrap');
  const [filter, setFilter] = useState('');
  const [suggestions, setSuggestions] = useState<NodeDetail[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [tagElement, setTagElement] = useState<Element | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [walkMode, setWalkMode] = useState<WalkModeState | null>(null);

  const bookmarkRef = useRef<unknown>(null);
  const applyingRef = useRef(false);
  const walkCurrentRangeRef = useRef<Range | null>(null);
  const walkCurrentElementRef = useRef<Element | null>(null);
  const walkIndexRef = useRef(0);
  const queueWalkRef = useRef<{
    search: string;
    tagName: string;
    lastRange: Range | null;
    lastElement: Element | null;
    oldTagName?: string;
    mode: TagCommandMode;
  } | null>(null);
  const walkPreviewActiveRef = useRef(false);

  useEffect(() => {
    if (!rootPath) return;
    void loadTagStats(rootPath).then((stats) => setTagCounts(getProjectTagCounts(stats)));
  }, [rootPath]);

  const visibleSuggestions = useMemo(
    () => filterTagSuggestions(suggestions, filter),
    [filter, suggestions],
  );

  const highlightedTag = visibleSuggestions[highlightedIndex] ?? null;

  const refreshStatsForActiveFile = useCallback(async () => {
    if (!rootPath || !activeTabPath || !window.writer?.getContent) return;
    const xml = await window.writer.getContent();
    if (!xml) return;
    const stats = await updateTagStatsForFile(rootPath, activeTabPath, xml);
    setTagCounts(getProjectTagCounts(stats));
  }, [activeTabPath, rootPath]);

  const closePopup = useCallback(() => {
    clearTagWalkHighlight();
    walkPreviewActiveRef.current = false;
    setOpen(false);
    setFilter('');
    queueWalkRef.current = null;
    bookmarkRef.current = null;
  }, []);

  const exitWalkMode = useCallback(() => {
    clearTagWalkHighlight();
    walkPreviewActiveRef.current = false;
    walkCurrentRangeRef.current = null;
    walkCurrentElementRef.current = null;
    walkIndexRef.current = 0;
    setWalkMode(null);
    queueWalkRef.current = null;
    window.writer?.editor?.focus();
  }, []);

  const loadSuggestions = useCallback(
    async (nextMode: TagCommandMode, ctx: NonNullable<ReturnType<typeof getEditorTagContext>>) => {
      const target = buildValidatorTarget(nextMode, ctx);
      const tags = await fetchTagSuggestions(target);
      const withFallbacks = withInsertModeFallbacks(tags, nextMode, ctx);
      const pinned = pinParagraphInsertOption(withFallbacks, nextMode, ctx);
      const sortPreferred =
        nextMode === 'wrap'
          ? readLastUsedTag() ?? undefined
          : nextMode === 'insert' || nextMode === 'lineBreak'
            ? DEFAULT_INSERT_TAG
            : undefined;
      const highlightPreferred =
        nextMode === 'rename'
          ? ctx.tagElement?.getAttribute('_tag') ?? undefined
          : nextMode === 'insert' || nextMode === 'lineBreak'
            ? DEFAULT_INSERT_TAG
            : readLastUsedTag() ?? undefined;
      const sorted = sortTagSuggestions(pinned, tagCounts, sortPreferred);
      setSuggestions(sorted);
      setHighlightedIndex(
        nextMode === 'insert' || nextMode === 'lineBreak' ? 0 : getDefaultHighlightIndex(sorted, nextMode, highlightPreferred ?? null),
      );
    },
    [tagCounts],
  );

  const openPopup = useCallback(
    async (nextMode: TagCommandMode) => {
      if (!isVisualEditorActive()) return false;

      const ctx = getEditorTagContext();
      if (!ctx) return false;

      if (nextMode === 'rename' && !ctx.tagElement) {
        notifyViaSnackbar({
          message: 'No tag at caret to rename.',
          options: { variant: 'info' },
        });
        return true;
      }

      if (nextMode === 'wrap' && !ctx.hasContentSelection) {
        nextMode = 'insert';
      }

      const editor = window.writer?.editor;
      if (editor) {
        bookmarkRef.current = editor.selection.getBookmark(1);
      }

      const text =
        nextMode === 'wrap'
          ? ctx.rng.toString()
          : nextMode === 'rename'
            ? (ctx.tagElement?.textContent ?? '').trim()
            : '';
      setSelectedText(text);
      setTagElement(ctx.tagElement);
      setMode(nextMode);
      setSuggestions([]);
      setHighlightedIndex(0);
      setFilter(nextMode === 'rename' ? ctx.tagElement?.getAttribute('_tag') ?? '' : '');
      setAnchor(getCaretScreenPosition());
      if (nextMode === 'rename') {
        const oldName = ctx.tagElement?.getAttribute('_tag') ?? '';
        setMatchCount(text ? countRenamableMatches(oldName, text) : 0);
      } else {
        setMatchCount(text ? countPropagatableMatches(text, readLastUsedTag() ?? '') : 0);
      }
      setOpen(true);
      await loadSuggestions(nextMode, ctx);
      return true;
    },
    [loadSuggestions, notifyViaSnackbar],
  );

  const notifyApplyResult = useCallback(
    (
      result: { applied: boolean; error?: string; tagName?: string },
      propagateInfo?: string,
      applyMode: TagCommandMode = mode,
    ) => {
      if (!result.applied) {
        if (result.error && result.error !== 'Cancelled') {
          notifyViaSnackbar({ message: result.error, options: { variant: 'warning' } });
        }
        return;
      }
      if (result.tagName) {
        const isDefaultParagraphInsert =
          (applyMode === 'insert' || applyMode === 'lineBreak') &&
          result.tagName === DEFAULT_INSERT_TAG;
        if (!isDefaultParagraphInsert) {
          writeLastUsedTag(result.tagName);
        }
        if (applyMode === 'wrap' && selectedText) {
          setMatchCount(countPropagatableMatches(selectedText, result.tagName));
        }
        if (applyMode === 'rename' && selectedText && tagElement) {
          const oldName = tagElement.getAttribute('_tag') ?? '';
          setMatchCount(countRenamableMatches(oldName, selectedText));
        }
      }
      if (propagateInfo) {
        notifyViaSnackbar({ message: propagateInfo, options: { variant: 'info' } });
      }
      void refreshStatsForActiveFile();
    },
    [mode, notifyViaSnackbar, refreshStatsForActiveFile, selectedText, tagElement],
  );

  const applyHighlightedRef = useRef<() => void>(() => {});
  const applyPropagateRef = useRef<() => void>(() => {});
  const applyQueueWalkRef = useRef<() => void>(() => {});

  const resolveTagForApply = useCallback((): NodeDetail | null => {
    const ctx = getEditorTagContext();
    const body = window.writer?.editor?.getBody();
    if (
      (mode === 'insert' || mode === 'lineBreak') &&
      !filter.trim() &&
      ctx &&
      body &&
      findParagraphAncestor(ctx.rng.startContainer, body)
    ) {
      return {
        name: DEFAULT_INSERT_TAG,
        type: 'tag',
        eventType: 'enterStartTag',
        invalid: false,
      };
    }

    if (highlightedTag && !highlightedTag.invalid) return highlightedTag;
    const name =
      filter.trim() ||
      ((mode === 'insert' || mode === 'lineBreak') ? DEFAULT_INSERT_TAG : '');
    if (!name) return null;
    const fromList = suggestions.find((tag) => tag.name === name && !tag.invalid);
    if (fromList) return fromList;
    if (
      (mode === 'insert' || mode === 'lineBreak') &&
      name === DEFAULT_INSERT_TAG &&
      getEditorTagContext()?.tagElement?.getAttribute('_tag') === DEFAULT_INSERT_TAG
    ) {
      return {
        name: DEFAULT_INSERT_TAG,
        type: 'tag',
        eventType: 'enterStartTag',
        invalid: false,
      };
    }
    return null;
  }, [filter, highlightedTag, mode, suggestions]);

  const applyTag = useCallback(
    async (tag: NodeDetail) => {
      if (applyingRef.current || tag.invalid) return;
      applyingRef.current = true;
      try {
        const result = await applyTagFromPopup(mode, tag, bookmarkRef.current, tagElement);
        notifyApplyResult(result, undefined, mode);
        if (result.applied) closePopup();
      } finally {
        applyingRef.current = false;
      }
    },
    [closePopup, mode, notifyApplyResult, tagElement],
  );

  const applyHighlighted = useCallback(async () => {
    if (applyingRef.current) return;
    const tag = resolveTagForApply();
    if (!tag) {
      notifyViaSnackbar({
        message: filter.trim()
          ? `Tag <${filter.trim()}> is not valid here.`
          : 'Pick a tag from the list.',
        options: { variant: 'info' },
      });
      return;
    }
    await applyTag(tag);
  }, [applyTag, filter, notifyViaSnackbar, resolveTagForApply]);

  applyHighlightedRef.current = () => void applyHighlighted();

  const applyPropagate = useCallback(() => {
    const tag = resolveTagForApply();
    if (!tag) return;

    if (mode === 'rename') {
      const oldTagName = tagElement?.getAttribute('_tag');
      if (!oldTagName) return;
      void propagateRenameInFile(oldTagName, tag.name, selectedText || undefined).then(
        ({ applied, skipped }) => {
          notifyApplyResult(
            { applied: applied > 0, tagName: tag.name },
            applied > 0
              ? `Renamed ${applied} tag${applied === 1 ? '' : 's'}${skipped ? `; skipped ${skipped}` : ''}.`
              : 'No tags were renamed.',
            'rename',
          );
          if (applied > 0) closePopup();
        },
      );
      return;
    }

    if (!selectedText) return;
    const { applied, skipped } = propagateTagInFile(selectedText, tag.name);
    notifyApplyResult(
      { applied: applied > 0, tagName: tag.name },
      applied > 0
        ? `Tagged ${applied} occurrence${applied === 1 ? '' : 's'}${skipped ? `; skipped ${skipped}` : ''}.`
        : 'No occurrences were tagged.',
      'wrap',
    );
    if (applied > 0) closePopup();
  }, [closePopup, mode, notifyApplyResult, resolveTagForApply, selectedText, tagElement]);

  applyPropagateRef.current = applyPropagate;

  const enterWalkMode = useCallback(() => {
    const tag = resolveTagForApply();
    if (!tag) {
      notifyViaSnackbar({
        message: filter.trim()
          ? `Tag <${filter.trim()}> is not valid here.`
          : 'Pick a tag from the list.',
        options: { variant: 'info' },
      });
      return;
    }

    if (mode === 'rename') {
      const oldTagName = tagElement?.getAttribute('_tag');
      if (!oldTagName || !selectedText) return;
      const remaining = countRenamableMatches(oldTagName, selectedText);
      if (remaining === 0) {
        notifyViaSnackbar({ message: 'No tags to rename.', options: { variant: 'info' } });
        return;
      }
      closePopup();
      setWalkMode({
        matchCount: remaining,
        mode: 'rename',
        oldTagName,
        search: selectedText,
        tagName: tag.name,
      });
      walkPreviewActiveRef.current = true;
      walkIndexRef.current = 0;
      walkCurrentElementRef.current = previewRenameWalkTarget(oldTagName, selectedText, 0);
      window.writer?.editor?.focus();
      return;
    }

    if (!selectedText) return;
    const remaining = countPropagatableMatches(selectedText, tag.name);
    if (remaining === 0) {
      notifyViaSnackbar({ message: 'No untagged matches.', options: { variant: 'info' } });
      return;
    }

    closePopup();
    setWalkMode({
      matchCount: remaining,
      mode: 'wrap',
      search: selectedText,
      tagName: tag.name,
    });
    walkPreviewActiveRef.current = true;
    walkIndexRef.current = 0;
    walkCurrentRangeRef.current = previewQueueWalkTarget(selectedText, tag.name, 0);
    window.writer?.editor?.focus();
  }, [
    closePopup,
    filter,
    mode,
    notifyViaSnackbar,
    resolveTagForApply,
    selectedText,
    tagElement,
  ]);

  const applyWalkStep = useCallback(() => {
    if (!walkMode) return;

    if (walkMode.mode === 'rename' && walkMode.oldTagName) {
      void applyRenameQueueWalkStepAt(
        walkMode.oldTagName,
        walkMode.tagName,
        walkMode.search,
        walkIndexRef.current,
      ).then((step) => {
        if (step.done) {
          notifyViaSnackbar({ message: 'Walk complete.', options: { variant: 'info' } });
          exitWalkMode();
          return;
        }
        notifyApplyResult(step.result, undefined, 'rename');
        if (!step.result.applied) {
          exitWalkMode();
          return;
        }
        writeLastUsedTag(walkMode.tagName);
        const elements = listRenamableElements(walkMode.oldTagName!, walkMode.search);
        const remaining = elements.length;
        if (remaining === 0) {
          notifyViaSnackbar({ message: 'Walk complete.', options: { variant: 'info' } });
          exitWalkMode();
          return;
        }
        walkIndexRef.current = Math.min(walkIndexRef.current, remaining - 1);
        setWalkMode((current) => (current ? { ...current, matchCount: remaining } : current));
        walkCurrentElementRef.current = previewRenameWalkTarget(
          walkMode.oldTagName!,
          walkMode.search,
          walkIndexRef.current,
        );
        void refreshStatsForActiveFile();
      });
      return;
    }

    let step: ReturnType<typeof applyQueueWalkStepAt>;
    try {
      step = applyQueueWalkStepAt(walkMode.search, walkMode.tagName, walkIndexRef.current);
    } catch (error) {
      notifyViaSnackbar({ message: String(error), options: { variant: 'warning' } });
      exitWalkMode();
      return;
    }

    if (step.done) {
      notifyViaSnackbar({ message: 'Walk complete.', options: { variant: 'info' } });
      exitWalkMode();
      return;
    }

    notifyApplyResult(step.result, undefined, 'wrap');
    if (!step.result.applied) {
      exitWalkMode();
      return;
    }

    writeLastUsedTag(walkMode.tagName);
    const ranges = listUntaggedRanges(walkMode.search, walkMode.tagName);
    if (ranges.length === 0) {
      notifyViaSnackbar({ message: 'Walk complete.', options: { variant: 'info' } });
      exitWalkMode();
      return;
    }
    walkIndexRef.current = Math.min(walkIndexRef.current, ranges.length - 1);
    const remaining = ranges.length;
    setWalkMode((current) => (current ? { ...current, matchCount: remaining } : current));
    walkCurrentRangeRef.current = previewQueueWalkTarget(
      walkMode.search,
      walkMode.tagName,
      walkIndexRef.current,
    );
    void refreshStatsForActiveFile();
  }, [exitWalkMode, notifyApplyResult, notifyViaSnackbar, refreshStatsForActiveFile, walkMode]);

  const skipWalkStep = useCallback(() => {
    if (!walkMode) return;

    if (walkMode.mode === 'rename' && walkMode.oldTagName) {
      const elements = listRenamableElements(walkMode.oldTagName, walkMode.search);
      if (elements.length === 0) {
        notifyViaSnackbar({ message: 'No more matches to skip to.', options: { variant: 'info' } });
        return;
      }
      walkIndexRef.current = Math.min(walkIndexRef.current + 1, elements.length - 1);
      walkCurrentElementRef.current = previewRenameWalkTarget(
        walkMode.oldTagName,
        walkMode.search,
        walkIndexRef.current,
      );
      return;
    }

    const ranges = listUntaggedRanges(walkMode.search, walkMode.tagName);
    if (ranges.length === 0) {
      notifyViaSnackbar({ message: 'No more matches to skip to.', options: { variant: 'info' } });
      return;
    }
    walkIndexRef.current = Math.min(walkIndexRef.current + 1, ranges.length - 1);
    walkCurrentRangeRef.current = previewQueueWalkTarget(
      walkMode.search,
      walkMode.tagName,
      walkIndexRef.current,
    );
  }, [notifyViaSnackbar, walkMode]);

  applyQueueWalkRef.current = enterWalkMode;

  const handlePopupKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup();
        return;
      }

      if (matchesTagPopupPropagate(event.nativeEvent)) {
        event.preventDefault();
        applyPropagate();
        return;
      }

      if (matchesTagPopupQueueWalk(event.nativeEvent)) {
        event.preventDefault();
        applyQueueWalkRef.current();
        return;
      }

      if (matchesTagPopupOpen(event.nativeEvent)) {
        event.preventDefault();
        event.stopPropagation();
        void applyHighlighted();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(current + 1, visibleSuggestions.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
      }
    },
    [applyHighlighted, applyPropagate, closePopup, visibleSuggestions.length],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      const visualActive = isVisualEditorActive();
      if (event.isComposing || !visualActive) return false;

      if (walkMode) {
        if (event.key === 'Escape') {
          exitWalkMode();
          return true;
        }
        if (matchesWalkModeSkip(event)) {
          event.preventDefault();
          skipWalkStep();
          return true;
        }
        if (matchesWalkModeTag(event)) {
          event.preventDefault();
          applyWalkStep();
          return true;
        }
      }

      if (open) {
        if (event.key === 'Escape') {
          closePopup();
          return true;
        }
        if (matchesTagPopupPropagate(event)) {
          applyPropagateRef.current();
          return true;
        }
        if (matchesTagPopupQueueWalk(event)) {
          applyQueueWalkRef.current();
          return true;
        }
        if (matchesTagPopupOpen(event)) {
          applyHighlightedRef.current();
          return true;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          return true;
        }
        return false;
      }

      if (matchesEditorRename(event)) {
        event.preventDefault();
        void openPopup('rename');
        return true;
      }

      if (matchesEditorLineBreak(event)) {
        event.preventDefault();
        void insertLineBreak().then((result) => {
          notifyApplyResult(result, undefined, 'lineBreak');
        });
        return true;
      }

      if (matchesEditorTagPopup(event)) {
        event.preventDefault();
        void openPopup('wrap');
        return true;
      }

      return false;
    },
    [applyWalkStep, closePopup, exitWalkMode, notifyApplyResult, open, openPopup, skipWalkStep, walkMode],
  );

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex((current) =>
      Math.min(current, Math.max(visibleSuggestions.length - 1, 0)),
    );
  }, [open, visibleSuggestions.length]);

  useEffect(() => {
    if (!open || !selectedText || !highlightedTag) return;
    if (mode === 'wrap') {
      setMatchCount(countPropagatableMatches(selectedText, highlightedTag.name));
    } else if (mode === 'rename' && tagElement) {
      const oldName = tagElement.getAttribute('_tag') ?? '';
      setMatchCount(countRenamableMatches(oldName, selectedText));
    }
  }, [highlightedTag, mode, open, selectedText, tagElement]);

  return {
    anchor,
    closePopup,
    exitWalkMode,
    filter,
    handleEditorKeyDown,
    handlePopupKeyDown,
    highlightedIndex,
    matchCount,
    mode,
    onApplyPropagate: applyPropagate,
    onApplyWalkStep: applyWalkStep,
    onEnterWalkMode: enterWalkMode,
    onApplySingle: () => void applyHighlighted(),
    onApplyTag: (tag) => void applyTag(tag),
    onSkipWalkStep: skipWalkStep,
    open,
    selectedText,
    setFilter,
    setHighlightedIndex,
    suggestions: visibleSuggestions,
    walkMode,
  };
};
