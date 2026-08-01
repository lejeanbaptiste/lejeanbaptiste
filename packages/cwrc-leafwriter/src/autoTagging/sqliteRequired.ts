/**
 * Shared fail-loud message when a path requires a migrated `entities.sqlite`
 * and must not fall back to DOM `loadEntities`/`saveEntities` (which can
 * full-reimport and clobber live SQLite, or treat sibling XML as live).
 */
export const SQLITE_REQUIRED_MESSAGE =
  'Entity database is not migrated to SQLite. Bridge / synchronisation require entities.sqlite.';

/** Panel list and edits use a slightly more specific wording but the same meaning. */
export const SQLITE_REQUIRED_PANEL_MESSAGE =
  'Entity database is not migrated to SQLite. Panel requires entities.sqlite.';

/** Lookup / disambiguation search, mint, and adopt require a migrated database. */
export const SQLITE_REQUIRED_LOOKUP_MESSAGE =
  'Entity database is not migrated to SQLite. Lookup and disambiguation require entities.sqlite.';

/**
 * `EntityStore.saveEntities` must not full-reimport a live `.sqlite` unless
 * the caller opts in (import/export tooling or fixtures).
 */
export const SQLITE_SAVE_REQUIRES_IMPORT_FLAG_MESSAGE =
  'Refusing to full-reimport entities.sqlite from XML. Pass { allowSqliteFullReimport: true } only from import/export tooling.';
