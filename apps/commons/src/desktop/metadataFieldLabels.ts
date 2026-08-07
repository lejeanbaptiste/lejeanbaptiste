import type { TFunction } from 'i18next';

/**
 * Managed project/file metadata field paths → i18n keys.
 * English `label` strings in schema catalogs stay as fallbacks / storage defaults;
 * the UI always prefers these keys when present.
 */
const METADATA_FIELD_LABEL_KEYS: Record<string, string> = {
  'publicationStmt/availability/licence': 'LWC.desktop.project.fields.licence',
  'publicationStmt/distributor': 'LWC.desktop.project.fields.publisher',
  'titleStmt/funder': 'LWC.desktop.project.fields.funder',
  'titleStmt/principal': 'LWC.desktop.project.fields.principal',
  'encodingDesc/projectDesc/p': 'LWC.desktop.project.fields.project_desc',
  'profileDesc/langUsage/language': 'LWC.desktop.project.fields.source_language',
  'FILEDESC/PUBLICATIONSTMT/AUTHORITY': 'LWC.desktop.project.fields.authority',
  'REVISIONDESC/RESPONSIBILITY': 'LWC.desktop.project.fields.encoder',
  'titleStmt/title': 'LWC.desktop.file_metadata.title',
  'sourceDesc/p': 'LWC.desktop.file_metadata.source',
  'FILEDESC/TITLESTMT/DOCTITLE': 'LWC.desktop.file_metadata.title',
  'FILEDESC/SOURCEDESC': 'LWC.desktop.file_metadata.source',
};

/** Localize a managed metadata field label; unknown paths keep `fallback`. */
export const localizeMetadataFieldLabel = (
  path: string,
  fallback: string,
  t: TFunction,
): string => {
  const key = METADATA_FIELD_LABEL_KEYS[path];
  return key ? t(key) : fallback;
};
