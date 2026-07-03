import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { findXmlFilesByName, listProjectXmlFiles } from './explorerFileOps';

describe('project enumerators exclude infrastructure', () => {
  let root = '';

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ljb-proj-'));
    await fs.writeFile(path.join(root, 'chapter1.xml'), '<TEI/>');
    await fs.writeFile(path.join(root, 'notes.xml'), '<TEI/>');
    await fs.mkdir(path.join(root, 'schema'));
    await fs.writeFile(path.join(root, 'schema', 'tei_all.rng'), '<grammar/>');
    await fs.mkdir(path.join(root, '.leaf'));
    await fs.writeFile(path.join(root, '.leaf', 'entities.xml'), '<TEI/>');
    await fs.writeFile(path.join(root, '.leaf', 'entity-decisions.jsonl'), '');
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('listProjectXmlFiles skips /.leaf/ and schema/', async () => {
    const names = (await listProjectXmlFiles(root)).map((f) => f.name);
    expect(names).toEqual(['chapter1.xml', 'notes.xml']);
    expect(names).not.toContain('entities.xml');
  });

  it('findXmlFilesByName never surfaces infrastructure files', async () => {
    // querying the entity file by name returns nothing
    expect(await findXmlFilesByName(root, 'entities')).toEqual([]);
    // normal files still found
    expect((await findXmlFilesByName(root, 'chapter')).map((f) => f.name)).toEqual(['chapter1.xml']);
  });
});
