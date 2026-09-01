/**
 * Ensure the configured central entity-database folder contains a live
 * `entities.sqlite`. `getEntityDbFolder` only mkdir's the directory; sync,
 * backup, and the database viewer all need the SQLite file to exist first.
 */
import { BrowserWindow } from 'electron';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createEntitiesScaffold } from '../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { AUTHORITY_PACKS_DIRNAME } from '../../commons/src/desktop/authorityPackTypes';
import { importEntitySqliteXml } from './entityDbSqlite/xmlCodec';
import { getEntityDbFolder } from './projectPrefs';

export const ENTITY_DB_FILENAME = 'entities.sqlite';
const ENTITY_XML_FILENAME = 'entities.xml';

export interface EnsuredEntityDatabase {
  folder: string;
  dbPath: string;
  created: boolean;
}

/** Tell every renderer window the on-disk entity database changed. */
export const notifyEntityDatabaseChanged = (): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('entityDatabase:changed');
  }
};

export const entityDatabaseFileExists = async (dbPath: string): Promise<boolean> => {
  try {
    await fs.access(dbPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Write `entities.xml` / `entities.sqlite` when missing. Never overwrites an
 * existing SQLite file (e.g. after an R2 restore that only dropped in `.sqlite`).
 */
export const scaffoldEntityDatabaseInFolder = async (
  normalizedFolder: string,
  xmlContent?: string,
): Promise<boolean> => {
  const entityFile = path.join(normalizedFolder, ENTITY_XML_FILENAME);
  const sqliteFile = path.join(normalizedFolder, ENTITY_DB_FILENAME);
  const sqliteExisted = existsSync(sqliteFile);
  const scaffold = xmlContent ?? createEntitiesScaffold();

  if (!existsSync(entityFile)) {
    await fs.writeFile(entityFile, scaffold, 'utf-8');
  }
  if (!existsSync(sqliteFile)) {
    const xml = existsSync(entityFile) ? await fs.readFile(entityFile, 'utf-8') : scaffold;
    await importEntitySqliteXml({ databasePath: sqliteFile, xml });
  }
  await fs.mkdir(path.join(normalizedFolder, AUTHORITY_PACKS_DIRNAME), { recursive: true });
  return !sqliteExisted;
};

/** Scaffold the app-level central folder when needed; no-op when already present. */
export const ensureDefaultEntityDatabase = async (): Promise<EnsuredEntityDatabase | null> => {
  const folder = await getEntityDbFolder();
  if (!folder) return null;
  const created = await scaffoldEntityDatabaseInFolder(folder);
  const dbPath = path.join(folder, ENTITY_DB_FILENAME);
  return { folder, dbPath, created };
};

/** Path to the live entity database, scaffolding first when the folder is empty. */
export const resolveLiveEntityDbPath = async (): Promise<string | null> => {
  const ensured = await ensureDefaultEntityDatabase();
  if (!ensured) return null;
  return (await entityDatabaseFileExists(ensured.dbPath)) ? ensured.dbPath : null;
};

export const hasLocalEntityDatabase = async (): Promise<boolean> =>
  Boolean(await resolveLiveEntityDbPath());
