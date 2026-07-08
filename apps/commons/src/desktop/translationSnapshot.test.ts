import type { ProjectBundle } from './projectFile';
import {
  buildSnapshotUnits,
  readTranslationSnapshot,
  writeTranslationSnapshot,
  type TranslationIndexFile,
} from './translationSnapshot';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const bundle = {
  config: {},
  projectFilePath: '/project/leaf-project.json',
  rootPath: '/project',
} as ProjectBundle;

const SOURCE_XML = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><div>
  <p xml:id="twu-aaa">First paragraph.</p>
  <p xml:id="twu-bbb">Second paragraph.</p>
  <p>No id yet.</p>
</div></body></text></TEI>`;

describe('buildSnapshotUnits', () => {
  test('records id, hash, index, and preview for units with ids, skipping id-less units', async () => {
    const units = await buildSnapshotUnits(parse(SOURCE_XML), 'p');

    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ id: 'twu-aaa', index: 0, preview: 'First paragraph.' });
    expect(units[1]).toMatchObject({ id: 'twu-bbb', index: 1 });
    expect(units[0]?.contentHash).toMatch(/^[0-9a-f]{16}$/);
    expect(units[0]?.contentHash).not.toBe(units[1]?.contentHash);
  });
});

describe('write/read round-trip', () => {
  let files: Record<string, string>;

  beforeEach(() => {
    files = {};
    const electronAPI = {
      readFile: jest.fn(async (path: string) => {
        if (!(path in files)) throw new Error('not found');
        return files[path];
      }),
      writeFile: jest.fn(async (path: string, content: string) => {
        files[path] = content;
      }),
      createDirectory: jest.fn(async (_parentDir: string, folderName: string) => folderName),
    };
    (window as Window & { electronAPI?: unknown }).electronAPI =
      electronAPI as unknown as Window['electronAPI'];
  });

  afterEach(() => {
    delete (window as Window & { electronAPI?: unknown }).electronAPI;
  });

  test('writes schema/translation-index.json and reads it back', async () => {
    await writeTranslationSnapshot(bundle, 'chapter1.xml', parse(SOURCE_XML), 'p');

    const snapshot = await readTranslationSnapshot(bundle);
    expect(snapshot?.version).toBe(1);
    expect(snapshot?.files['chapter1.xml']).toHaveLength(2);
  });

  test('merges per-file entries without clobbering other files', async () => {
    const existing: TranslationIndexFile = {
      version: 1,
      files: { 'other.xml': [{ id: 'x', contentHash: 'h', index: 0, preview: '' }] },
    };
    files['/project/schema/translation-index.json'] = JSON.stringify(existing);

    await writeTranslationSnapshot(bundle, 'chapter1.xml', parse(SOURCE_XML), 'p');

    const snapshot = await readTranslationSnapshot(bundle);
    expect(snapshot?.files['other.xml']).toHaveLength(1);
    expect(snapshot?.files['chapter1.xml']).toHaveLength(2);
  });

  test('returns null for missing or corrupt snapshot files', async () => {
    expect(await readTranslationSnapshot(bundle)).toBeNull();

    files['/project/schema/translation-index.json'] = 'not json';
    expect(await readTranslationSnapshot(bundle)).toBeNull();
  });
});
