/** Minimal Writer surface for reading exportable XML. */
export interface DocumentContentReader {
  converter: {
    getDocumentContent: (includeRDF: boolean) => Promise<string | null | undefined>;
  };
  getContent?: () => Promise<string | null | undefined>;
  overmindState?: {
    document?: { xml?: string };
  };
}

/**
 * Resolve the current document as TEI XML, with fallbacks when the visual
 * editor body is empty or not yet convertible (e.g. mid tab switch).
 */
export async function resolveCurrentDocumentXml(
  writer: DocumentContentReader,
): Promise<string> {
  let fromEditor = '';
  try {
    fromEditor =
      (await writer.converter.getDocumentContent(false)) ||
      (await writer.converter.getDocumentContent(true)) ||
      (await writer.getContent?.()) ||
      '';
  } catch {
    // No convertible content (no root element) — fall through to stored XML.
  }

  if (fromEditor) {
    const mergeForValidation = window.__desktopMergeHeaderForValidation;
    if (typeof mergeForValidation === 'function') {
      return mergeForValidation(fromEditor);
    }
    return fromEditor;
  }

  const stored =
    window.__desktopStoredDocumentXml ?? writer.overmindState?.document?.xml;
  if (stored?.trim()) {
    const mergeForValidation = window.__desktopMergeHeaderForValidation;
    if (typeof mergeForValidation === 'function') {
      return mergeForValidation(stored);
    }
    return stored;
  }

  throw new Error('AutoTaggingSession: could not read the current document');
}
