import type { SourceDescription } from './sourceDescription';
import {
  applyProfileToSource,
  applySourceProfileToFolderFiles,
  dedupeProjectSources,
  fileInSameFolder,
  profileIdentityKey,
  profileLabelFromSource,
  toSharedSource,
} from './sourceProfiles';

const sampleSource = (overrides: Partial<SourceDescription> = {}): SourceDescription => ({
  title: 'Nanqi shu',
  titleRef: 'https://www.wikidata.org/entity/Q123',
  authors: [{ name: 'Xiao Zixian' }],
  workDate: { when: '0537' },
  edition: 'Zhonghua shuju',
  editionDate: '1974',
  sourceNote: 'Juan 12',
  ...overrides,
});

describe('profileIdentityKey', () => {
  it('prefers titleRef over title', () => {
    expect(profileIdentityKey(sampleSource({ title: 'Other' }))).toBe(
      'ref:https://www.wikidata.org/entity/Q123',
    );
  });

  it('falls back to titleKey then normalized title', () => {
    expect(
      profileIdentityKey(
        sampleSource({ titleRef: undefined, titleKey: 'work-000010', title: 'Nanqi shu' }),
      ),
    ).toBe('key:work-000010');
    expect(
      profileIdentityKey(
        sampleSource({ titleRef: undefined, titleKey: undefined, title: '  Nanqi shu ' }),
      ),
    ).toBe('title:nanqi shu');
  });
});

describe('dedupeProjectSources', () => {
  it('groups identical sources and counts files', () => {
    const shared = sampleSource();
    const deduped = dedupeProjectSources([
      { source: shared, filePath: '/a/vol01.xml' },
      { source: { ...shared, sourceNote: 'Juan 13' }, filePath: '/a/vol02.xml' },
      {
        source: sampleSource({ title: 'Other work', titleRef: 'https://example.org/other' }),
        filePath: '/a/other.xml',
      },
    ]);

    expect(deduped).toHaveLength(2);
    const nanqi = deduped.find((entry) => entry.label === 'Nanqi shu');
    expect(nanqi?.fileCount).toBe(2);
    expect(nanqi?.samplePath).toBe('/a/vol01.xml');
  });

  it('skips empty sources', () => {
    expect(
      dedupeProjectSources([
        {
          source: sampleSource({
            title: '',
            authors: [],
            titleRef: undefined,
            titleKey: undefined,
          }),
          filePath: '/a/empty.xml',
        },
      ]),
    ).toHaveLength(0);
  });
});

describe('applyProfileToSource', () => {
  it('copies shared fields but preserves transcription source', () => {
    const current = sampleSource({ sourceNote: 'Local note' });
    const profile = toSharedSource(
      sampleSource({ edition: 'Updated edition', sourceNote: 'ignored' }),
    );
    const merged = applyProfileToSource(current, profile);

    expect(merged.edition).toBe('Updated edition');
    expect(merged.sourceNote).toBe('Local note');
  });
});

describe('profileLabelFromSource', () => {
  it('defaults to Untitled source when title is blank', () => {
    expect(profileLabelFromSource(toSharedSource(sampleSource({ title: '   ' })))).toBe(
      'Untitled source',
    );
  });
});

describe('fileInSameFolder', () => {
  it('matches files in the same directory across path separators', () => {
    expect(fileInSameFolder('/proj/vol01/ch1.xml', '/proj/vol01/ch2.xml')).toBe(true);
    expect(fileInSameFolder('C:\\proj\\vol01\\ch1.xml', 'C:/proj/vol01/ch2.xml')).toBe(true);
    expect(fileInSameFolder('/proj/vol01/ch1.xml', '/proj/vol02/ch1.xml')).toBe(false);
  });
});

describe('applySourceProfileToFolderFiles', () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('writes merged source metadata to files in the same folder only', async () => {
    const writes = new Map<string, string>();
    window.electronAPI = {
      listProjectXmlFiles: jest.fn(async () => [
        { path: '/proj/vol01/a.xml', name: 'a.xml' },
        { path: '/proj/vol01/b.xml', name: 'b.xml' },
        { path: '/proj/vol02/c.xml', name: 'c.xml' },
      ]),
      readFile: jest.fn(async (filePath: string) => {
        if (filePath.endsWith('a.xml')) {
          return `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Old A</title></titleStmt></fileDesc></teiHeader><text><body><p/></body></text></TEI>`;
        }
        if (filePath.endsWith('b.xml')) {
          return `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Old B</title></titleStmt></fileDesc></teiHeader><text><body><p/></body></text></TEI>`;
        }
        return `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Other</title></titleStmt></fileDesc></teiHeader><text><body><p/></body></text></TEI>`;
      }),
      writeFile: jest.fn(async (filePath: string, content: string) => {
        writes.set(filePath, content);
      }),
    } as unknown as typeof window.electronAPI;

    const result = await applySourceProfileToFolderFiles(
      '/proj',
      '/proj/vol01/a.xml',
      'teiSimplePrint',
      toSharedSource(sampleSource({ sourceNote: 'ignored' })),
    );

    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(writes.has('/proj/vol01/a.xml')).toBe(true);
    expect(writes.has('/proj/vol01/b.xml')).toBe(true);
    expect(writes.has('/proj/vol02/c.xml')).toBe(false);
    expect(writes.get('/proj/vol01/a.xml')).toContain('Nanqi shu');
  });
});
