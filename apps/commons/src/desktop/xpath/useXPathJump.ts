import { useActions, useAppState } from '@src/overmind';
import { useCallback, useEffect, useRef } from 'react';
import { findEditorNodeByTeiXPath } from './teiXPathWalker';
import type { PendingXPathJump } from './types';
import { performXPathJumpInSourceEditor } from './xpathSourceJump';

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

const normalizeXPathForEditor = (xpath: string) => xpath.replace(/^\/+/, '');

const selectEditorElement = (element: Element, focusEditor: boolean) => {
  if (!window.writer?.editor) return false;
  const xpath = window.writer.utilities.getElementXPath(element);
  if (!xpath) return false;
  window.writer.utilities.selectNode({ xpath }, false, focusEditor);
  return true;
};

const performVisualJump = (jump: PendingXPathJump, focusEditor = false): boolean => {
  if (!window.writer?.editor) return false;

  const body = window.writer.editor.getBody();

  if (jump.id) {
    const element = body.querySelector(`#${CSS.escape(jump.id)}`);
    if (element && selectEditorElement(element, focusEditor)) {
      return true;
    }
  }

  if (jump.xpath) {
    const byTeiWalk = findEditorNodeByTeiXPath(body, jump.xpath);
    if (byTeiWalk && selectEditorElement(byTeiWalk, focusEditor)) {
      return true;
    }

    const cwrcXpath = normalizeXPathForEditor(jump.xpath);
    window.writer.utilities.selectNode({ xpath: cwrcXpath }, false, focusEditor);
    const selected = window.writer.editor.selection.getNode();
    if (selected && isElement(selected) && body.contains(selected)) {
      return true;
    }

    const node = window.writer.utilities.evaluateXPath(body, cwrcXpath);
    if (node && typeof node !== 'boolean' && typeof node !== 'number' && typeof node !== 'string') {
      if (isElement(node) && selectEditorElement(node, focusEditor)) {
        return true;
      }
    }
  }

  const nodes = window.writer.utilities.evaluateXPathAll(body, jump.query);
  const node = nodes[jump.matchIndex];
  if (node && isElement(node)) {
    const xpath = window.writer.utilities.getElementXPath(node);
    if (xpath) {
      window.writer.utilities.selectNode({ xpath }, false, focusEditor);
      return true;
    }
  }

  return false;
};

const performJump = (jump: PendingXPathJump, focusEditor = false): boolean => {
  if (isSourceEditorMode()) {
    return performXPathJumpInSourceEditor(jump);
  }

  return performVisualJump(jump, focusEditor);
};

export const useXPathJump = (onAfterJump?: () => void) => {
  const { activeTabPath } = useAppState().project;
  const { resource } = useAppState().editor;
  const { openFile } = useActions().project;

  const pendingJumpRef = useRef<PendingXPathJump | null>(null);
  const onAfterJumpRef = useRef(onAfterJump);
  const resourceFilePathRef = useRef(resource?.filePath);
  const activeTabPathRef = useRef(activeTabPath);
  onAfterJumpRef.current = onAfterJump;
  resourceFilePathRef.current = resource?.filePath;
  activeTabPathRef.current = activeTabPath;

  const completeJump = useCallback(() => {
    pendingJumpRef.current = null;
    onAfterJumpRef.current?.();
  }, []);

  const tryPerformPendingJump = useCallback(() => {
    const jump = pendingJumpRef.current;
    if (!jump || !window.writer) return false;

    const isSourceMode = isSourceEditorMode();
    if (!isSourceMode && !window.writer.editor) return false;

    const currentPath = resourceFilePathRef.current ?? activeTabPathRef.current;
    if (currentPath !== jump.filePath) {
      return false;
    }

    if (performJump(jump, false)) {
      completeJump();
      return true;
    }

    return false;
  }, [completeJump]);

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

  const jumpToMatch = useCallback(
    (jump: PendingXPathJump) => {
      const currentFilePath = resource?.filePath ?? activeTabPath;
      const isActive = currentFilePath === jump.filePath;
      const isSourceMode = isSourceEditorMode();

      if (isActive && window.writer && (isSourceMode || window.writer.editor)) {
        if (performJump(jump, false)) {
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
    [activeTabPath, openFile, resource?.filePath, schedulePendingJumpRetries],
  );

  return { jumpToMatch };
};
