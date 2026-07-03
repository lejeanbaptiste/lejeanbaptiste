/**
 * Project infrastructure lives under a reserved `/.leaf/` directory (entity
 * authority file, decision log, etc.). Whole-project operations — find,
 * replace, auto-tag crawl, export, corpus validation — must skip it. This is
 * the reserved-path layer; the manifest `role: "infrastructure"` check is the
 * authoritative backstop applied on top.
 */

export const INFRASTRUCTURE_DIR = '.leaf';

/** True when any path segment is the reserved infrastructure directory. */
export const isInfrastructurePath = (filePath: string): boolean =>
  filePath.split(/[/\\]+/).includes(INFRASTRUCTURE_DIR);
