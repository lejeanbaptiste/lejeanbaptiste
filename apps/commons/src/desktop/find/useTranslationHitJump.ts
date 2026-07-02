import { useActions, useAppState } from '@src/overmind';
import { useCallback, useRef } from 'react';
import { resolveTranslationHitTarget } from './translationHitJump';

const log = (...args: unknown[]) => console.log('[translation-jump]', ...args);

const isElement = (node: unknown): node is Element =>
  !!node && typeof node === 'object' && (node as Node).nodeType === Node.ELEMENT_NODE;

/** Selects the source element with the given xml:id, if the document is loaded and tagged. */
const selectSourceUnit = (unitId: string): boolean => {
  const writer = window.writer;
  if (!writer?.editor) {
    log('selectSourceUnit: no editor yet', unitId);
    return false;
  }

  const body = writer.editor.getBody();
  const node = writer.utilities.evaluateXPath(body, `//*[@xml:id="${unitId}"]`);
  if (!isElement(node)) {
    log('selectSourceUnit: xml:id not found in source DOM', unitId);
    return false;
  }

  const xpath = writer.utilities.getElementXPath(node);
  if (!xpath) {
    log('selectSourceUnit: found element but could not compute its own xpath', unitId);
    return false;
  }

  // focusEditor=false, matching normal find/xpath navigation — keeps keyboard focus in the
  // Find panel so arrow-key/Enter result navigation keeps working after a jump.
  writer.utilities.selectNode({ xpath }, false, false);
  log('selectSourceUnit: selected', unitId, xpath);
  return true;
};

export interface TranslationHitJumpParams {
  filePath: string;
  start: number;
  end: number;
}

/**
 * Opens the source file for a Find hit that landed inside a translation companion file,
 * switches the right panel to the Translation tab, requests the matching language, and
 * (best-effort) selects the source paragraph the match falls in — so source and translation
 * end up shown side by side, on the right unit.
 */
export const useTranslationHitJump = () => {
  const { activeTabPath } = useAppState().project;
  const { resource } = useAppState().editor;
  const { openFile } = useActions().project;

  const pendingUnitIdRef = useRef<string | null>(null);

  const scheduleUnitSelectRetries = useCallback((unitId: string) => {
    pendingUnitIdRef.current = unitId;
    for (const delay of [0, 150, 400, 900, 1800, 3000]) {
      setTimeout(() => {
        if (pendingUnitIdRef.current !== unitId) return;
        log('retry attempt at', delay, 'ms for', unitId);
        if (selectSourceUnit(unitId)) pendingUnitIdRef.current = null;
      }, delay);
    }
  }, []);

  const jumpToTranslationHit = useCallback(
    async ({ filePath, start, end }: TranslationHitJumpParams) => {
      log('jumpToTranslationHit', { filePath, start, end });

      const target = await resolveTranslationHitTarget(filePath, start, end);
      log('resolved target', target);
      if (!target) {
        log('could not resolve target — aborting');
        return;
      }

      log('showTab(translation), bridge exists?', !!window.__desktopRightPanel);
      window.__desktopRightPanel?.showTab('translation');

      const currentPath = resource?.filePath ?? activeTabPath;
      log('currentPath', currentPath, 'target.sourcePath', target.sourcePath);
      if (currentPath !== target.sourcePath) {
        log('opening source file', target.sourcePath);
        await openFile(target.sourcePath);
        log('openFile resolved');
      }

      // Requesting the language (even if it's already selected) re-triggers the tab's own
      // auto-index effect for this (file, lang) pair, which resolves/creates the companion
      // file and enters translation mode — no need to duplicate that logic here.
      log('dispatching translation-request-language', target.lang);
      window.dispatchEvent(
        new CustomEvent('desktop:translation-request-language', { detail: { lang: target.lang } }),
      );

      if (target.unitId) {
        log('scheduling unit select retries for', target.unitId);
        scheduleUnitSelectRetries(target.unitId);

        if (target.matchedText) {
          log(
            'dispatching translation-highlight-text',
            target.unitId,
            target.matchedText,
            target.offsetInUnitText,
          );
          window.dispatchEvent(
            new CustomEvent('desktop:translation-highlight-text', {
              detail: {
                unitId: target.unitId,
                text: target.matchedText,
                offset: target.offsetInUnitText,
              },
            }),
          );
        }
      } else {
        log('no unitId resolved — nothing to select in source editor');
      }
    },
    [activeTabPath, openFile, resource?.filePath, scheduleUnitSelectRetries],
  );

  return { jumpToTranslationHit };
};
