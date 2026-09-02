/** Minimal Writer surface for reading exportable XML. */
export interface DocumentContentReader {
  converter: {
    getDocumentContent: (includeRDF: boolean) => Promise<string | null | undefined>;
  };
  getContent?: () => Promise<string | null | undefined>;
  overmindState?: {
    document?: { xml?: string };
    ui?: {
      editorViewMode?: 'source' | 'visual';
      sourceCurrentContent?: string;
    };
  };
}

function applyHeaderMerge(xml: string): string {
  const mergeForValidation = window.__desktopMergeHeaderForValidation;
  if (typeof mergeForValidation === 'function') {
    return mergeForValidation(xml);
  }
  return xml;
}

function editorViewMode(writer: DocumentContentReader): 'source' | 'visual' | undefined {
  return (
    writer.overmindState?.ui?.editorViewMode ?? window.writer?.overmindState?.ui?.editorViewMode
  );
}

function storedSnapshot(writer: DocumentContentReader): string | undefined {
  const stored = window.__desktopStoredDocumentXml ?? writer.overmindState?.document?.xml;
  return stored?.trim() ? stored : undefined;
}

function sourceBuffer(writer: DocumentContentReader): string | undefined {
  const source =
    writer.overmindState?.ui?.sourceCurrentContent ??
    window.writer?.overmindState?.ui?.sourceCurrentContent;
  return source?.trim() ? source : undefined;
}

/**
 * Resolve the current document as TEI XML, with fallbacks when the visual
 * editor body is empty or not yet convertible (e.g. mid tab switch).
 *
 * In visual mode, prefer the desktop stored snapshot (same as file metadata
 * and validation) so milestone elements such as `<pb>` and `<lb>` survive
 * auto-tagging even when the WYSIWYG export omits them between text nodes.
 */
export async function resolveCurrentDocumentXml(writer: DocumentContentReader): Promise<string> {
  const viewMode = editorViewMode(writer);

  if (viewMode === 'source') {
    const source = sourceBuffer(writer);
    if (source) return applyHeaderMerge(source);
  }

  if (viewMode === 'visual') {
    const stored = storedSnapshot(writer);
    if (stored) return applyHeaderMerge(stored);
  }

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
    return applyHeaderMerge(fromEditor);
  }

  const stored = storedSnapshot(writer);
  if (stored) return applyHeaderMerge(stored);

  throw new Error('AutoTaggingSession: could not read the current document');
}
