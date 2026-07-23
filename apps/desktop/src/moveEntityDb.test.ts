import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MoveEntityDbError, moveEntityDbFolder } from './moveEntityDb';

const scaffoldEntityDb = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'entities.xml'), '<entities/>', 'utf-8');
  await fs.mkdir(path.join(dir, 'authority-packs'), { recursive: true });
  await fs.mkdir(path.join(dir, '.ljb-time-machine'), { recursive: true });
  await fs.writeFile(path.join(dir, '.ljb-time-machine', 'snap.json'), '{}', 'utf-8');
};

describe('moveEntityDbFolder', () => {
  let root = '';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ljb-move-entity-db-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('renames into a new path when the destination does not exist', async () => {
    const source = path.join(root, 'source-db');
    const dest = path.join(root, 'dest-db');
    await scaffoldEntityDb(source);

    await moveEntityDbFolder(source, dest);

    await expect(fs.access(dest)).resolves.toBeUndefined();
    await expect(fs.readFile(path.join(dest, 'entities.xml'), 'utf-8')).resolves.toBe('<entities/>');
    await expect(fs.access(source)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses when the destination already contains entities.xml', async () => {
    const source = path.join(root, 'source-db');
    const dest = path.join(root, 'dest-db');
    await scaffoldEntityDb(source);
    await scaffoldEntityDb(dest);

    await expect(moveEntityDbFolder(source, dest)).rejects.toThrow(MoveEntityDbError);
    await expect(fs.access(source)).resolves.toBeUndefined();
    await expect(fs.readFile(path.join(dest, 'entities.xml'), 'utf-8')).resolves.toBe('<entities/>');
  });

  it('refuses nested source/destination paths', async () => {
    const source = path.join(root, 'source-db');
    const nestedDest = path.join(source, 'nested');
    await scaffoldEntityDb(source);
    await fs.mkdir(nestedDest, { recursive: true });

    await expect(moveEntityDbFolder(source, nestedDest)).rejects.toThrow(MoveEntityDbError);

    const outerDest = path.join(root, 'outer');
    await fs.mkdir(outerDest, { recursive: true });
    const innerSource = path.join(outerDest, 'inner');
    await scaffoldEntityDb(innerSource);

    await expect(moveEntityDbFolder(innerSource, outerDest)).rejects.toThrow(MoveEntityDbError);
  });

  it('copies then deletes when the destination folder already exists empty', async () => {
    const source = path.join(root, 'source-db');
    const dest = path.join(root, 'dest-db');
    await scaffoldEntityDb(source);
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, 'readme.txt'), 'keep me', 'utf-8');

    await moveEntityDbFolder(source, dest);

    await expect(fs.readFile(path.join(dest, 'entities.xml'), 'utf-8')).resolves.toBe('<entities/>');
    await expect(fs.readFile(path.join(dest, 'readme.txt'), 'utf-8')).resolves.toBe('keep me');
    await expect(fs.access(source)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('falls back to copy+delete when rename fails with EXDEV', async () => {
    const source = path.join(root, 'source-db');
    const dest = path.join(root, 'dest-db');
    await scaffoldEntityDb(source);

    const renameSpy = jest.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('EXDEV'), { code: 'EXDEV' }));

    await moveEntityDbFolder(source, dest);

    renameSpy.mockRestore();

    await expect(fs.readFile(path.join(dest, 'entities.xml'), 'utf-8')).resolves.toBe('<entities/>');
    await expect(fs.access(source)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
