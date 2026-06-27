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

  const tryPerformPendingJump = useCallback(() => {
    const jump = pendingJumpRef.current;
    if (!jump || !window.writer?.editor) return false;

    const currentPath = resourceFilePathRef.current ?? activeTabPathRef.current;
    if (currentPath !== jump.filePath) return false;

    const content = getTabContent(jump.filePath);
    if (!content) return false;

    if (
      performFindJump({
        content,
        end: jump.end,
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
  }, [completeJump, getTabContent]);

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
      const content = getTabContent(jump.filePath);

      if (isActive && window.writer?.editor && content) {
        if (
          performFindJump({
            content,
            end: jump.end,
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
    [activeTabPath, getTabContent, openFile, resource?.filePath, schedulePendingJumpRetries],
  );

  return { jumpToHit };
};
