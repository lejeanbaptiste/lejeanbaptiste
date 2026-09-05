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
    { name: '.grognard', path: '/proj/.grognard', isDirectory: true },
    { name: '.grognard-time-machine', path: '/proj/.grognard-time-machine', isDirectory: true },
    { name: 'sub', path: '/proj/sub', isDirectory: true },
  ],
  '/proj/.grognard': [
    {
      name: 'entity-decisions.jsonl',
      path: '/proj/.grognard/entity-decisions.jsonl',
      isDirectory: false,
    },
  ],
  '/proj/.grognard-time-machine': [
    { name: 'snapshots', path: '/proj/.grognard-time-machine/snapshots', isDirectory: true },
  ],
  '/proj/.grognard-time-machine/snapshots': [
    {
      name: 'chapter1.xml',
      path: '/proj/.grognard-time-machine/snapshots/chapter1.xml',
      isDirectory: false,
    },
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

  it('recurses into normal folders but skips .grognard/, .grognard-time-machine/, and entities.xml', async () => {
    const files = await collectXmlFiles('/proj');
    expect(files).toEqual(['/proj/chapter1.xml', '/proj/sub/chapter2.xml']);
    expect(files).not.toContain('/proj/entities.xml');
    expect(files).not.toContain('/proj/.grognard/entity-decisions.jsonl');
    expect(files).not.toContain('/proj/.grognard-time-machine/snapshots/chapter1.xml');
  });
});
