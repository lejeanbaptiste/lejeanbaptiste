import type { ProjectMetadataFile } from './projectTypes';
import { getMetadataFieldsForCatalog } from './schemaMetadataFields';

export const SCHEMA_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const isSchemaCheckThrottled = (lastCheckedAt?: string): boolean => {
  if (!lastCheckedAt) return false;
  const checked = Date.parse(lastCheckedAt);
  if (Number.isNaN(checked)) return false;
  return Date.now() - checked < SCHEMA_UPDATE_CHECK_INTERVAL_MS;
};

export const buildArchiveDestName = (basename: string, versionLabel?: string): string => {
  const dotIndex = basename.lastIndexOf('.');
  const stem = dotIndex === -1 ? basename : basename.slice(0, dotIndex);
  const ext = dotIndex === -1 ? '' : basename.slice(dotIndex);
  const label = versionLabel ?? new Date().toISOString().replace(/[:.]/g, '-');
  return `${stem}-${label}${ext}`;
};

export const schemaHashesDiffer = (
  local: { sourceHash?: string; sourceCssHash?: string },
  remote: { cssHash?: string; rngHash: string },
): { cssChanged: boolean; rngChanged: boolean } => {
  const rngChanged = Boolean(local.sourceHash && local.sourceHash !== remote.rngHash);
  const cssChanged = Boolean(
    local.sourceCssHash && remote.cssHash && local.sourceCssHash !== remote.cssHash,
  );
  return { cssChanged, rngChanged };
};

/** Re-check when project JSON or on-disk schema files changed since the last network check. */
export const shouldBypassSchemaCheckThrottle = (
  lastCheckedAt: string | undefined,
  projectFileMtimeMs: number,
  storedRngHash: string | undefined,
  onDiskRngHash: string | undefined,
  storedCssHash?: string,
  onDiskCssHash?: string,
): boolean => {
  const lastCheckedMs = lastCheckedAt ? Date.parse(lastCheckedAt) : Number.NaN;
  if (!Number.isNaN(lastCheckedMs) && projectFileMtimeMs > lastCheckedMs) {
    return true;
  }
  if (storedRngHash && onDiskRngHash && storedRngHash !== onDiskRngHash) {
    return true;
  }
  if (storedCssHash && onDiskCssHash && storedCssHash !== onDiskCssHash) {
    return true;
  }
  return false;
};

export const validateMetadataPathsAfterUpgrade = (
  metadata: ProjectMetadataFile,
  catalogId?: string | null,
): string[] => {
  const warnings: string[] = [];
  const effectiveCatalogId = catalogId ?? metadata.catalogId;
  const { fields } = getMetadataFieldsForCatalog(effectiveCatalogId);
  const managedPaths = new Set(fields.map((field) => field.path));

  for (const [fieldPath, value] of Object.entries(metadata.fields ?? {})) {
    if (value.trim() && !managedPaths.has(fieldPath)) {
      warnings.push(
        `Edition metadata field "${fieldPath}" is not in the current schema field map. Review in Edition metadata.`,
      );
    }
  }

  for (const row of metadata.custom ?? []) {
    const fieldPath = row.path?.trim();
    if (fieldPath && (row.value?.trim() || row.label?.trim())) {
      warnings.push(
        `Custom metadata path "${fieldPath}" may need review after a schema update.`,
      );
    }
  }

  return warnings;
};
