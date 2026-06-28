export interface MetadataFieldDefinition {
  label: string;
  path: string;
}

export const TEI_V1_METADATA_FIELDS: MetadataFieldDefinition[] = [
  { label: 'Licence / rights', path: 'publicationStmt/availability/licence' },
  { label: 'Publisher / distributor', path: 'publicationStmt/distributor' },
  { label: 'Funder', path: 'titleStmt/funder' },
  { label: 'Principal (encoder)', path: 'titleStmt/principal' },
  { label: 'Encoding project description', path: 'encodingDesc/projectDesc/p' },
  { label: 'Default language', path: 'profileDesc/langUsage/language' },
];

export const TEI_SIMPLE_PRINT_METADATA_FIELDS: MetadataFieldDefinition[] =
  TEI_V1_METADATA_FIELDS.filter((field) => field.path !== 'titleStmt/principal');

export const JTEI_METADATA_FIELDS: MetadataFieldDefinition[] = [
  { label: 'Publisher / distributor', path: 'publicationStmt/distributor' },
  { label: 'Encoding project description', path: 'encodingDesc/projectDesc/p' },
  { label: 'Default language', path: 'profileDesc/langUsage/language' },
];

export const ORLANDO_METADATA_FIELDS: MetadataFieldDefinition[] = [
  { label: 'Authority', path: 'FILEDESC/PUBLICATIONSTMT/AUTHORITY' },
  { label: 'Encoder', path: 'REVISIONDESC/RESPONSIBILITY' },
];

/** Paths excluded from bulk apply to existing files by default. */
export const BULK_APPLY_EXCLUDED_PATHS = new Set([
  'titleStmt/title',
  'sourceDesc',
  'fileDesc/sourceDesc',
  'FILEDESC/TITLESTMT/DOCTITLE',
  'FILEDESC/SOURCEDESC',
  'ORLANDOHEADER/FILEDESC/TITLESTMT/DOCTITLE',
  'ORLANDOHEADER/FILEDESC/SOURCEDESC',
]);

export type MetadataFieldSetKind = 'tei' | 'orlando' | 'custom';

export const getMetadataFieldsForCatalog = (
  catalogId?: string | null,
): { fields: MetadataFieldDefinition[]; kind: MetadataFieldSetKind; note?: string } => {
  if (!catalogId || catalogId === 'teiAll' || catalogId === 'teiLite') {
    return { fields: TEI_V1_METADATA_FIELDS, kind: 'tei' };
  }

  if (catalogId === 'teiSimplePrint') {
    return { fields: TEI_SIMPLE_PRINT_METADATA_FIELDS, kind: 'tei' };
  }

  if (catalogId === 'jTei') {
    return { fields: JTEI_METADATA_FIELDS, kind: 'tei' };
  }

  if (catalogId === 'orlando') {
    return { fields: ORLANDO_METADATA_FIELDS, kind: 'orlando' };
  }

  if (catalogId === 'local-tei') {
    return {
      fields: TEI_V1_METADATA_FIELDS,
      kind: 'tei',
      note: 'Local TEI schema — using standard TEI header fields.',
    };
  }

  return {
    fields: [],
    kind: 'custom',
    note: 'Non-catalog schema — add custom metadata fields below. No automatic field map.',
  };
};

export const getAllManagedPaths = (
  fields: MetadataFieldDefinition[],
  custom: Array<{ path: string }>,
): string[] => {
  const paths = fields.map((field) => field.path);
  for (const row of custom) {
    if (row.path.trim()) paths.push(row.path.trim());
  }
  return paths;
};

export const isOrlandoCatalog = (catalogId?: string | null): boolean => catalogId === 'orlando';
