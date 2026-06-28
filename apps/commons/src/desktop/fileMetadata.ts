import {
  applyOrlandoHeaderPathUpdates,
  hasOrlandoHeader,
  readOrlandoHeaderPathValues,
} from './orlandoHeaderXml';
import { isOrlandoCatalog } from './schemaMetadataFields';
import {
  applyHeaderPathUpdates,
  hasTeiHeader,
  readHeaderPathValues,
} from './teiHeaderXml';

export interface FileMetadataFieldDefinition {
  label: string;
  path: string;
}

export const TEI_FILE_METADATA_FIELDS: FileMetadataFieldDefinition[] = [
  { label: 'Title', path: 'titleStmt/title' },
  { label: 'Source', path: 'sourceDesc/p' },
];

export const ORLANDO_FILE_METADATA_FIELDS: FileMetadataFieldDefinition[] = [
  { label: 'Title', path: 'FILEDESC/TITLESTMT/DOCTITLE' },
  { label: 'Source', path: 'FILEDESC/SOURCEDESC' },
];

/** @deprecated Use getFileMetadataFieldsForCatalog */
export const FILE_METADATA_FIELDS = TEI_FILE_METADATA_FIELDS;

const TEI_CATALOG_IDS = new Set([
  'teiAll',
  'teiLite',
  'teiSimplePrint',
  'jTei',
  'local-tei',
]);

export const isTeiCatalogForFileMetadata = (catalogId?: string | null): boolean =>
  !catalogId || TEI_CATALOG_IDS.has(catalogId);

export const getFileMetadataFieldsForCatalog = (
  catalogId?: string | null,
): FileMetadataFieldDefinition[] =>
  isOrlandoCatalog(catalogId) ? ORLANDO_FILE_METADATA_FIELDS : TEI_FILE_METADATA_FIELDS;

export const readFileMetadataFromXml = (
  xml: string,
  catalogId?: string | null,
): Record<string, string> => {
  const fields = getFileMetadataFieldsForCatalog(catalogId);
  const paths = fields.map((field) => field.path);
  if (isOrlandoCatalog(catalogId)) {
    return readOrlandoHeaderPathValues(xml, paths);
  }
  return readHeaderPathValues(xml, paths);
};

export const applyFileHeaderFields = (
  xml: string,
  updates: Record<string, string>,
  catalogId?: string | null,
): string => {
  const entries = Object.entries(updates).map(([path, value]) => ({ path, value }));
  if (isOrlandoCatalog(catalogId)) {
    return applyOrlandoHeaderPathUpdates(xml, entries);
  }
  return applyHeaderPathUpdates(xml, entries);
};

export const documentSupportsFileMetadata = (
  xml: string,
  catalogId?: string | null,
): boolean => {
  if (isOrlandoCatalog(catalogId)) return hasOrlandoHeader(xml);
  if (isTeiCatalogForFileMetadata(catalogId)) return hasTeiHeader(xml);
  return false;
};

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
