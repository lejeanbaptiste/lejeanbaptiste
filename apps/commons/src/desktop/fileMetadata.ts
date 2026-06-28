import {
  applyHeaderPathUpdates,
  hasTeiHeader,
  readHeaderPathValues,
} from './teiHeaderXml';

export interface FileMetadataFieldDefinition {
  label: string;
  path: string;
}

export const FILE_METADATA_FIELDS: FileMetadataFieldDefinition[] = [
  { label: 'Title', path: 'titleStmt/title' },
  { label: 'Source', path: 'sourceDesc/p' },
];

const TEI_CATALOG_IDS = new Set(['teiAll', 'teiLite', 'local-tei']);

export const isTeiCatalogForFileMetadata = (catalogId?: string | null): boolean =>
  !catalogId || TEI_CATALOG_IDS.has(catalogId);

export const readFileMetadataFromXml = (xml: string): Record<string, string> =>
  readHeaderPathValues(
    xml,
    FILE_METADATA_FIELDS.map((field) => field.path),
  );

export const applyFileHeaderFields = (
  xml: string,
  updates: Record<string, string>,
): string => {
  const entries = Object.entries(updates).map(([path, value]) => ({ path, value }));
  return applyHeaderPathUpdates(xml, entries);
};

export const documentSupportsFileMetadata = (
  xml: string,
  catalogId?: string | null,
): boolean => isTeiCatalogForFileMetadata(catalogId) && hasTeiHeader(xml);

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

export interface PushXmlToActiveEditorParams {
  content: string;
  filePath: string;
  markTabDirty: (dirty: boolean) => void;
  updateTabContent: (params: { content: string; filePath: string }) => void;
}

/** Update tab memory and sync the live editor when the file is active. */
export const pushXmlToActiveEditor = ({
  content,
  filePath,
  markTabDirty,
  updateTabContent,
}: PushXmlToActiveEditorParams): void => {
  updateTabContent({ filePath, content });
  markTabDirty(true);

  const activePath =
    window.writer?.overmindState?.document?.url ??
    window.writer?.overmindState?.editor?.resource?.filePath;
  if (activePath !== filePath) return;

  window.writer?.overmindActions?.document?.setDocumentXml?.(content);

  if (isSourceEditorMode()) {
    window.writer?.overmindActions?.ui?.setSourceCurrentContent?.(content);
    return;
  }

  window.writer?.overmindActions?.document?.updateXMLHeader?.(content);
};
