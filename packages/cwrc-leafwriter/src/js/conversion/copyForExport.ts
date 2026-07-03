/**
 * Glue for "Copy for export": resolves source/translation alignment-unit pairs from
 * the two documents, converts them via buildClipboardExport, and writes all clipboard
 * flavors at once (RTF carries native footnotes and live Zotero fields; the receiving
 * app picks the richest flavor it understands).
 */

import {
  buildClipboardExport,
  type ExportBiblEntry,
  type ExportUnitPair,
} from './clipboardExport';

interface TranslationModeInfo {
  alignmentUnit: 'div' | 'p' | null;
  sourcePath: string | null;
  translationPath: string | null;
}

interface CopyForExportOptions {
  translationMode: TranslationModeInfo;
  unitIds: string[];
  /** In-memory translation document with unsaved edits, if the caller has one;
   * otherwise the translation file is read from disk. */
  translationDoc?: Document | null;
  notify?: (message: string) => void;
}

interface DesktopApi {
  readFile?: (filePath: string) => Promise<string>;
  writeClipboardRich?: (flavors: {
    text: string;
    html?: string;
    rtf?: string;
  }) => Promise<void>;
}

interface CitationBridge {
  readBiblEntries?: (doc: Document) => Map<string, ExportBiblEntry>;
}

const getDesktopApi = (): DesktopApi | undefined =>
  (window as Window & { electronAPI?: DesktopApi }).electronAPI;

const getCitationBridge = (): CitationBridge | null =>
  (window as Window & { __desktopCitationBridge?: CitationBridge }).__desktopCitationBridge ??
  null;

const getElementsByLocalName = (root: Document | Element, localName: string): Element[] =>
  Array.from(root.getElementsByTagName('*')).filter(
    (element) => element.localName === localName,
  );

const fileNameOf = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx === -1 ? filePath : filePath.slice(idx + 1);
};

const parseXml = (xml: string): Document | null => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
};

const findUnitById = (doc: Document, alignmentUnit: string, unitId: string): Element | null =>
  getElementsByLocalName(doc, alignmentUnit).find(
    (element) =>
      element.getAttribute('xml:id') === unitId || element.getAttribute('id') === unitId,
  ) ?? null;

const findUnitByCorresp = (
  doc: Document,
  alignmentUnit: string,
  sourceFileName: string,
  unitId: string,
): Element | null => {
  const expected = `${sourceFileName}#${unitId}`;
  return (
    getElementsByLocalName(doc, alignmentUnit).find(
      (element) => element.getAttribute('corresp') === expected,
    ) ?? null
  );
};

const writeClipboard = async (flavors: {
  text: string;
  html: string;
  rtf: string;
}): Promise<void> => {
  const api = getDesktopApi();
  if (api?.writeClipboardRich) {
    await api.writeClipboardRich(flavors);
    return;
  }
  // Web fallback: no RTF flavor available, write text + HTML.
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([flavors.text], { type: 'text/plain' }),
      'text/html': new Blob([flavors.html], { type: 'text/html' }),
    }),
  ]);
};

interface EditorLike {
  getBody?: () => HTMLElement | null;
  selection?: { getRng?: () => Range | null; getNode?: () => Element | null };
}

interface WriterLike {
  editor?: EditorLike | null;
  schemaManager?: { getIdName?: () => string };
  tagger?: { getAttributesForTag?: (element: Element) => Record<string, string> };
}

/** Alignment-unit ids covered by the current editor selection, in document order.
 * A collapsed caret yields the single unit it sits in. */
export const collectSelectedUnitIds = (
  writer: WriterLike | undefined,
  alignmentUnit: string,
): string[] => {
  const body = writer?.editor?.getBody?.();
  const range = writer?.editor?.selection?.getRng?.();
  if (!body || !range) return [];

  const schemaId = writer?.schemaManager?.getIdName?.() ?? 'xml:id';
  const idOf = (element: Element): string | null => {
    const attrs = writer?.tagger?.getAttributesForTag?.(element) ?? {};
    const id = attrs[schemaId] ?? (schemaId !== 'id' ? attrs.id : undefined);
    return typeof id === 'string' && id ? id : null;
  };

  const units = Array.from(body.querySelectorAll(`[_tag="${alignmentUnit}"]`)).filter((unit) =>
    range.intersectsNode(unit),
  );

  if (units.length === 0) {
    // Collapsed caret (or selection outside units): use the enclosing unit.
    let node: Element | null = writer?.editor?.selection?.getNode?.() ?? null;
    while (node && node.getAttribute?.('_tag') !== alignmentUnit) node = node.parentElement;
    if (node) units.push(node);
  }

  return units
    .map(idOf)
    .filter((id): id is string => id !== null)
    .filter((id, index, all) => all.indexOf(id) === index);
};

/** Copies the given alignment units (source + translation, interleaved) to the
 * clipboard. Returns true when something was copied. */
export const copyUnitsForExport = async ({
  translationMode,
  unitIds,
  translationDoc,
  notify,
}: CopyForExportOptions): Promise<boolean> => {
  const { alignmentUnit, sourcePath, translationPath } = translationMode;
  const report = notify ?? (() => undefined);

  if (!alignmentUnit || !sourcePath || unitIds.length === 0) {
    report('Nothing to copy: no alignment unit selected.');
    return false;
  }

  const api = getDesktopApi();
  if (!api?.readFile) {
    report('Copy for export is only available in the desktop app.');
    return false;
  }

  const sourceDoc = parseXml(await api.readFile(sourcePath));
  if (!sourceDoc) {
    report('Could not parse the source document.');
    return false;
  }

  let transDoc: Document | null = translationDoc ?? null;
  if (!transDoc && translationPath) {
    try {
      transDoc = parseXml(await api.readFile(translationPath));
    } catch {
      transDoc = null; // No translation file yet — copy source only.
    }
  }

  const sourceFileName = fileNameOf(sourcePath);
  const pairs: ExportUnitPair[] = [];
  const missing: string[] = [];

  for (const unitId of unitIds) {
    const source = findUnitById(sourceDoc, alignmentUnit, unitId);
    const translation = transDoc
      ? findUnitByCorresp(transDoc, alignmentUnit, sourceFileName, unitId)
      : null;
    if (!source && !translation) {
      missing.push(unitId);
      continue;
    }
    pairs.push({ source, translation });
  }

  if (pairs.length === 0) {
    report('Could not find the selected units.');
    return false;
  }

  const biblEntries =
    (transDoc && getCitationBridge()?.readBiblEntries?.(transDoc)) ||
    new Map<string, ExportBiblEntry>();

  await writeClipboard(buildClipboardExport(pairs, biblEntries));

  const unitsCopied = pairs.length;
  const withTranslation = pairs.filter((pair) => pair.translation).length;
  const suffix = missing.length > 0 ? ` (${missing.length} not found)` : '';
  report(
    `Copied ${unitsCopied} unit${unitsCopied === 1 ? '' : 's'} ` +
      `(${withTranslation} with translation)${suffix}.`,
  );
  return true;
};
