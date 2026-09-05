/**
 * Hidden project infrastructure lives under `/.grognard/` (decision log, authority
 * cache, etc.) and `/.grognard-time-machine/` (project snapshots). The visible
 * `entities.xml` at project root (project mode) is also excluded from corpus
 * scans. Whole-project operations must skip all of these.
 */

export const INFRASTRUCTURE_DIR = '.grognard';
export const TIME_MACHINE_DIR = '.grognard-time-machine';
export const ENTITIES_FILE_NAME = 'entities.xml';

/** Directory names that walkers should never descend into. */
export const INFRASTRUCTURE_DIR_NAMES = new Set([INFRASTRUCTURE_DIR, TIME_MACHINE_DIR]);

export const isInfrastructureDirName = (name: string): boolean =>
  INFRASTRUCTURE_DIR_NAMES.has(name);

export const normalizePathKey = (filePath: string): string =>
  filePath
    .split(/[/\\]+/)
    .filter(Boolean)
    .join('/')
    .toLowerCase();

export const pathsMatch = (a: string, b: string): boolean =>
  normalizePathKey(a) === normalizePathKey(b);

/** True when any path segment is a reserved infrastructure directory. */
export const isInfrastructurePath = (filePath: string): boolean =>
  filePath.split(/[/\\]+/).some((segment) => isInfrastructureDirName(segment));

/**
 * True for the project-local entity database file at `{projectRoot}/entities.xml`.
 * Central-database paths outside the project are never enumerated.
 */
export const isEntityDatabasePath = (filePath: string, projectRoot?: string): boolean => {
  const normalized = normalizePathKey(filePath);
  if (!normalized.endsWith(`/${ENTITIES_FILE_NAME.toLowerCase()}`)) return false;
  if (!projectRoot) return true;
  const root = normalizePathKey(projectRoot).replace(/\/+$/, '');
  return normalized === `${root}/${ENTITIES_FILE_NAME.toLowerCase()}`;
};

/** Skip hidden infra or the project entity database file. */
export const isCorpusExcludedPath = (filePath: string, projectRoot?: string): boolean =>
  isInfrastructurePath(filePath) || isEntityDatabasePath(filePath, projectRoot);
