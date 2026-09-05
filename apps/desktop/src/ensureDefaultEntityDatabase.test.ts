import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { scaffoldEntityDatabaseInFolder } from './ensureDefaultEntityDatabase';

describe('scaffoldEntityDatabaseInFolder', () => {
  let root = '';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'grognard-entity-db-scaffold-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('creates entities.xml when only sqlite exists (R2 restore left no XML)', async () => {
    const sqlitePath = path.join(root, 'entities.sqlite');
    await fs.writeFile(sqlitePath, 'restored-placeholder', 'utf-8');

    await scaffoldEntityDatabaseInFolder(root);

    expect(existsSync(path.join(root, 'entities.xml'))).toBe(true);
    await expect(fs.readFile(sqlitePath, 'utf-8')).resolves.toBe('restored-placeholder');
  });

  it('does not replace an existing sqlite file (e.g. after R2 restore)', async () => {
    const sqlitePath = path.join(root, 'entities.sqlite');
    await fs.writeFile(sqlitePath, 'restored-placeholder', 'utf-8');

    const created = await scaffoldEntityDatabaseInFolder(root);

    expect(created).toBe(false);
    await expect(fs.readFile(sqlitePath, 'utf-8')).resolves.toBe('restored-placeholder');
    expect(existsSync(path.join(root, 'entities.xml'))).toBe(true);
  });
});
