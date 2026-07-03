import { collectXmlFiles } from './collectXmlFiles';

interface FakeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

const tree: Record<string, FakeEntry[]> = {
  '/proj': [
    { name: 'chapter1.xml', path: '/proj/chapter1.xml', isDirectory: false },
    { name: '.leaf', path: '/proj/.leaf', isDirectory: true },
    { name: 'sub', path: '/proj/sub', isDirectory: true },
  ],
  '/proj/.leaf': [{ name: 'entities.xml', path: '/proj/.leaf/entities.xml', isDirectory: false }],
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

  it('recurses into normal folders but never into /.leaf/', async () => {
    const files = await collectXmlFiles('/proj');
    expect(files).toEqual(['/proj/chapter1.xml', '/proj/sub/chapter2.xml']);
    expect(files).not.toContain('/proj/.leaf/entities.xml');
  });
});
