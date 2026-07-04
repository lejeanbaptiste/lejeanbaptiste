import { joinProjectPath } from './projectFile';
import {
  getMetadataFieldsForCatalog,
  type MetadataFieldDefinition,
  type MetadataFieldSetKind,
} from './schemaMetadataFields';
import {
  getFileMetadataFieldsForCatalog,
  type FileMetadataFieldDefinition,
} from './fileMetadata';

export const METADATA_FIELDS_TEMPLATE_PATH = 'schema/metadata-fields.json';

export interface TemplateProjectField extends MetadataFieldDefinition {
  /** Prefilled value shown when the project has no stored value yet. */
  default?: string;
}

export interface TemplateFileField extends FileMetadataFieldDefinition {
  multiline?: boolean;
}

export interface MetadataFieldsTemplate {
  version: 1;
  project?: TemplateProjectField[];
  file?: TemplateFileField[];
}

const sanitizeRows = <T extends { path?: string; label?: string }>(
  rows: unknown,
): T[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object' && typeof (row as T).path === 'string',
    )
    .map((row) => ({
      ...row,
      path: String(row.path).trim(),
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : String(row.path).trim(),
    }))
    .filter((row) => row.path) as unknown as T[];
};

export const parseMetadataFieldsTemplate = (raw: string): MetadataFieldsTemplate | null => {
  try {
    const parsed = JSON.parse(raw) as MetadataFieldsTemplate;
    if (!parsed || typeof parsed !== 'object') return null;
    const project = sanitizeRows<TemplateProjectField>(parsed.project);
    const file = sanitizeRows<TemplateFileField>(parsed.file);
    if (project.length === 0 && file.length === 0) return null;
    return { version: 1, project, file };
  } catch {
    return null;
  }
};

export const readMetadataFieldsTemplate = async (
  rootPath: string,
): Promise<MetadataFieldsTemplate | null> => {
  if (!window.electronAPI?.readFile) return null;
  const templatePath = joinProjectPath(rootPath, METADATA_FIELDS_TEMPLATE_PATH);
  try {
    if (window.electronAPI.pathExists && !(await window.electronAPI.pathExists(templatePath))) {
      return null;
    }
    const raw = await window.electronAPI.readFile(templatePath);
    return parseMetadataFieldsTemplate(raw);
  } catch {
    return null;
  }
};

export const resolveProjectMetadataFields = (
  template: MetadataFieldsTemplate | null,
  catalogId?: string | null,
): { fields: MetadataFieldDefinition[]; kind: MetadataFieldSetKind; note?: string } => {
  if (template?.project?.length) {
    return {
      fields: template.project,
      kind: 'custom',
      note: `Fields from project template (${METADATA_FIELDS_TEMPLATE_PATH}).`,
    };
  }
  return getMetadataFieldsForCatalog(catalogId);
};

export const resolveFileMetadataFields = (
  template: MetadataFieldsTemplate | null,
  catalogId?: string | null,
): TemplateFileField[] =>
  template?.file?.length ? template.file : getFileMetadataFieldsForCatalog(catalogId);

/** Template defaults for project fields with no stored value yet. */
export const applyTemplateDefaults = (
  values: Record<string, string>,
  template: MetadataFieldsTemplate | null,
): Record<string, string> => {
  if (!template?.project?.length) return values;
  const next = { ...values };
  for (const field of template.project) {
    if (field.default && !next[field.path]?.trim()) {
      next[field.path] = field.default;
    }
  }
  return next;
};
