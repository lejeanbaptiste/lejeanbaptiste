import { parseTranslationFilePath } from '../translationFileNaming';
import { resolveTextHitInXml } from './resolveTextHitInXml';

const log = (...args: unknown[]) => console.log('[translation-jump]', ...args);

const splitDirAndFile = (filePath: string): { dir: string; file: string } => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx === -1) return { dir: '', file: filePath };
  return { dir: filePath.slice(0, idx + 1), file: filePath.slice(idx + 1) };
};

export interface TranslationHitTarget {
  sourcePath: string;
  lang: string;
  /** The alignment-unit's xml:id in the source file, if it could be resolved. */
  unitId: string | null;
  /** The raw matched substring, for highlighting within the translation pane. */
  matchedText: string | null;
  /** Exact decoded-character offsets of the match within the unit's own text — set only when
   * the match falls directly in the unit element's text (not inside a nested inline tag like
   * <b>), letting the pane select the precise occurrence instead of always the first one. */
  offsetInUnitText: { start: number; end: number } | null;
}

/**
 * Given a text-search hit inside a translation companion file, resolves which source file and
 * language it belongs to, and (best-effort) which alignment-unit id contains the match, by
 * walking up from the matched element to the nearest ancestor carrying @corresp.
 */
export const resolveTranslationHitTarget = async (
  translationFilePath: string,
  hitStart: number,
  hitEnd: number,
): Promise<TranslationHitTarget | null> => {
  const parsed = parseTranslationFilePath(translationFilePath);
  if (!parsed) return null;

  const { dir } = splitDirAndFile(translationFilePath);
  const sourcePath = `${dir}${parsed.sourceFileName}`;
  const fallback: TranslationHitTarget = {
    sourcePath,
    lang: parsed.lang,
    unitId: null,
    matchedText: null,
    offsetInUnitText: null,
  };

  if (!window.electronAPI?.readFile) {
    log('no electronAPI.readFile — returning fallback', fallback);
    return fallback;
  }

  try {
    const content = await window.electronAPI.readFile(translationFilePath);
    const resolved = resolveTextHitInXml(content, hitStart, hitEnd);
    log('resolveTextHitInXml result', resolved);
    if (!resolved) return fallback;

    const doc = new DOMParser().parseFromString(content, 'application/xml');
    if (doc.getElementsByTagName('parsererror')[0]) {
      log('translation file failed to parse as XML');
      return fallback;
    }

    const evaluated = doc.evaluate(
      resolved.teiXPath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    const matchedElement = evaluated.singleNodeValue as Element | null;
    let node = matchedElement;
    log('node at teiXPath', resolved.teiXPath, '->', node?.tagName, node?.outerHTML?.slice(0, 80));
    while (node && !node.getAttribute('corresp')) {
      node = node.parentElement;
    }
    log('nearest ancestor with corresp', node?.tagName, node?.getAttribute('corresp'));

    const corresp = node?.getAttribute('corresp') ?? null;
    const hashIndex = corresp?.indexOf('#') ?? -1;
    const unitId = corresp && hashIndex >= 0 ? corresp.slice(hashIndex + 1) : null;
    const matchedText = content.slice(hitStart, hitEnd) || null;
    // Offsets are only meaningful relative to the unit itself — if the match was inside a
    // nested inline tag (e.g. <b>) rather than directly in the unit's text, node !== the
    // resolved element, and the offsets don't apply to the unit as a whole.
    const offsetInUnitText =
      node === matchedElement
        ? { start: resolved.startInElementText, end: resolved.endInElementText }
        : null;
    log('offsetInUnitText', offsetInUnitText);

    return { sourcePath, lang: parsed.lang, unitId, matchedText, offsetInUnitText };
  } catch (error) {
    log('threw while resolving hit target', error);
    return fallback;
  }
};
