import { useActions, useAppState } from '@src/overmind';
import { useCallback, useEffect, useRef } from 'react';
import { performFindJump } from './performFindJump';
import type { PendingFindJump } from './types';

export const useFindNavigation = (onAfterJump?: () => void) => {
  const { activeTabPath, openTabs } = useAppState().project;
  const { resource } = useAppState().editor;
  const { openFile } = useActions().project;

  const pendingJumpRef = useRef<PendingFindJump | null>(null);
  const onAfterJumpRef = useRef(onAfterJump);
  const resourceFilePathRef = useRef(resource?.filePath);
  const activeTabPathRef = useRef(activeTabPath);
  const openTabsRef = useRef(openTabs);

  onAfterJumpRef.current = onAfterJump;
  resourceFilePathRef.current = resource?.filePath;
  activeTabPathRef.current = activeTabPath;
  openTabsRef.current = openTabs;

  const getTabContent = useCallback((filePath: string) => {
    return openTabsRef.current.find((tab) => tab.filePath === filePath)?.content;
  }, []);

  const completeJump = useCallback(() => {
    pendingJumpRef.current = null;
    onAfterJumpRef.current?.();
  }, []);

  const getContentForJump = useCallback(
    (filePath: string) => {
      if (window.writer?.overmindState?.ui?.editorViewMode === 'source') {
        const currentPath = resourceFilePathRef.current ?? activeTabPathRef.current;
        if (currentPath === filePath) {
          return window.writer.overmindState.ui.sourceCurrentContent;
        }
      }

      return getTabContent(filePath);
    },
    [getTabContent],
  );

  const tryPerformPendingJump = useCallback(() => {
    const jump = pendingJumpRef.current;
    if (!jump || !window.writer) return false;

    const isSourceMode = window.writer.overmindState?.ui?.editorViewMode === 'source';
    if (!isSourceMode && !window.writer.editor) return false;

    const currentPath = resourceFilePathRef.current ?? activeTabPathRef.current;
    if (currentPath !== jump.filePath) return false;

    const content = getContentForJump(jump.filePath);
    if (!content) return false;

    if (
      performFindJump({
        content,
        contentForJump: jump.contentForJump,
        end: jump.end,
        highlightMode: jump.highlightMode,
        matchIndexInFile: jump.matchIndexInFile,
        query: jump.query,
        start: jump.start,
        useRegex: jump.useRegex,
      })
    ) {
      completeJump();
      return true;
    }

    return false;
  }, [completeJump, getContentForJump]);

  const schedulePendingJumpRetries = useCallback(() => {
    for (const delay of [0, 100, 350, 800, 1500]) {
      setTimeout(() => {
        if (pendingJumpRef.current) tryPerformPendingJump();
      }, delay);
    }
  }, [tryPerformPendingJump]);

  useEffect(() => {
    const writer = window.writer;
    if (!writer) return;

    const onDocumentLoaded = (success: boolean) => {
      if (!success || !pendingJumpRef.current) return;
      schedulePendingJumpRetries();
    };

    writer.event('documentLoaded').subscribe(onDocumentLoaded);
    return () => {
      writer.event('documentLoaded').unsubscribe(onDocumentLoaded);
    };
  }, [schedulePendingJumpRetries]);

  const jumpToHit = useCallback(
    (jump: PendingFindJump) => {
      const currentFilePath = resource?.filePath ?? activeTabPath;
      const isActive = currentFilePath === jump.filePath;
      const isSourceMode = window.writer?.overmindState?.ui?.editorViewMode === 'source';
      const content = getContentForJump(jump.filePath);

      if (isActive && window.writer && content && (isSourceMode || window.writer.editor)) {
        if (
          performFindJump({
            content,
            contentForJump: jump.contentForJump,
            end: jump.end,
            highlightMode: jump.highlightMode,
            matchIndexInFile: jump.matchIndexInFile,
            query: jump.query,
            start: jump.start,
            useRegex: jump.useRegex,
          })
        ) {
          pendingJumpRef.current = null;
          onAfterJumpRef.current?.();
        } else {
          pendingJumpRef.current = jump;
          schedulePendingJumpRetries();
        }
        return;
      }

      pendingJumpRef.current = jump;
      void (async () => {
        await openFile(jump.filePath);
        schedulePendingJumpRetries();
      })();
    },
    [activeTabPath, getContentForJump, openFile, resource?.filePath, schedulePendingJumpRetries],
  );

  return { jumpToHit };
};
