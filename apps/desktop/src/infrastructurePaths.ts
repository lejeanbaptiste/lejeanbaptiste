/**
 * Hidden project infrastructure lives under `/.ljb/` (decision log, authority
 * cache, etc.). The visible `entities.xml` at project root (project mode) is
 * also excluded from corpus scans. Whole-project operations must skip both.
 */

export const INFRASTRUCTURE_DIR = '.ljb';
export const ENTITIES_FILE_NAME = 'entities.xml';

/** True when any path segment is the reserved infrastructure directory. */
export const isInfrastructurePath = (filePath: string): boolean =>
  filePath.split(/[/\\]+/).includes(INFRASTRUCTURE_DIR);

/**
 * True for the project-local entity database file at `{projectRoot}/entities.xml`.
 * Central-database paths outside the project are never enumerated.
 */
export const isEntityDatabasePath = (filePath: string, projectRoot?: string): boolean => {
  const normalized = filePath.split(/[/\\]+/).join('/');
  if (!normalized.endsWith(`/${ENTITIES_FILE_NAME}`)) return false;
  if (!projectRoot) return normalized.endsWith(`/${ENTITIES_FILE_NAME}`);
  const root = projectRoot.split(/[/\\]+/).join('/').replace(/\/+$/, '');
  return normalized === `${root}/${ENTITIES_FILE_NAME}`;
};

/** Skip hidden infra or the project entity database file. */
export const isCorpusExcludedPath = (filePath: string, projectRoot?: string): boolean =>
  isInfrastructurePath(filePath) || isEntityDatabasePath(filePath, projectRoot);
