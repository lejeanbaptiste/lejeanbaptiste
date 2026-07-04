import { collectXmlFiles } from './collectXmlFiles';

interface FakeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const tree: Record<string, FakeEntry[]> = {
  '/proj': [
    { name: 'chapter1.xml', path: '/proj/chapter1.xml', isDirectory: false },
    { name: 'entities.xml', path: '/proj/entities.xml', isDirectory: false },
    { name: '.ljb', path: '/proj/.ljb', isDirectory: true },
    { name: 'sub', path: '/proj/sub', isDirectory: true },
  ],
  '/proj/.ljb': [
    { name: 'entity-decisions.jsonl', path: '/proj/.ljb/entity-decisions.jsonl', isDirectory: false },
  ],
  '/proj/sub': [{ name: 'chapter2.xml', path: '/proj/sub/chapter2.xml', isDirectory: false }],
};

describe('collectXmlFiles', () => {
  const original = window.electronAPI;
  beforeEach(() => {
    window.electronAPI = {
      readDirectory: async (dirPath: string) => tree[dirPath] ?? [],
    } as unknown as typeof window.electronAPI;
  });
  afterEach(() => {
    window.electronAPI = original;
  });

  it('recurses into normal folders but skips .ljb/ and entities.xml', async () => {
    const files = await collectXmlFiles('/proj');
    expect(files).toEqual(['/proj/chapter1.xml', '/proj/sub/chapter2.xml']);
    expect(files).not.toContain('/proj/entities.xml');
    expect(files).not.toContain('/proj/.ljb/entity-decisions.jsonl');
  });
});
