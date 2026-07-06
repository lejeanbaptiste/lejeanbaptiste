import { isChineseLanguageCode } from '@cwrc/leafwriter/languageCodes';

import type { ProjectBundle } from './projectFile';
import { readProjectMetadata } from './projectMetadata';
import { isOrlandoCatalog } from './schemaMetadataFields';
import type { ProjectMetadataFile } from './projectTypes';
import { normalizeSourceLanguageCode } from '@cwrc/leafwriter/languageCodes';

/** TEI metadata path holding the project's source-document language. */
export const SOURCE_LANGUAGE_PATH = 'profileDesc/langUsage/language';

export const sourceLanguageFromMetadata = (
  metadata: ProjectMetadataFile | null,
): string | null => {
  const value = metadata?.fields?.[SOURCE_LANGUAGE_PATH]?.trim();
  return value ? normalizeSourceLanguageCode(value) : null;
};

/** Source language is mandatory for TEI projects; Orlando has no language field. */
export const projectRequiresSourceLanguage = (bundle: ProjectBundle): boolean =>
  !isOrlandoCatalog(bundle.config.schema?.catalogId);

export const getProjectSourceLanguage = async (
  bundle: ProjectBundle,
): Promise<string | null> => sourceLanguageFromMetadata(await readProjectMetadata(bundle));

/**
 * Chinese gate (auto-tagging Phase A0): CBDB/DILA authority sources are only
 * offered when the project's source language is Chinese.
 */
export const isChineseEnabled = async (bundle: ProjectBundle): Promise<boolean> =>
  isChineseLanguageCode(await getProjectSourceLanguage(bundle));
