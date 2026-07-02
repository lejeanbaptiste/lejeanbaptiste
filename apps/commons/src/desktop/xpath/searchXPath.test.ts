import { evaluateXPathAll, getXPathForElement, parseXmlDocument } from './evaluateXPathAll';
import { searchXPath } from './searchXPath';

const sampleXml = `<?xml version="1.0"?>
<TEI>
  <text>
    <body>
      <p>One</p>
      <p>Two</p>
    </body>
  </text>
</TEI>`;

describe('searchXPath raw XML paths', () => {
  test('builds stable TEI xpath strings for matches', () => {
    const doc = parseXmlDocument(sampleXml);
    expect(doc).not.toBeNull();

    const nodes = evaluateXPathAll(doc!, '//p');
    expect(nodes).toHaveLength(2);

    const paths = nodes.map((node) => getXPathForElement(node, doc!));
    expect(paths[0]).toContain('p[');
    expect(paths[1]).toContain('p[');
    expect(paths[0]).not.toBe(paths[1]);
  });
});

describe('searchXPath translation-file exclusion', () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  test('excludes companion translation files from project scope', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readDirectory: jest.fn().mockResolvedValue([
        { name: 'chapter1.xml', path: '/proj/chapter1.xml', isDirectory: false },
        {
          name: 'chapter1.fr.translation.xml',
          path: '/proj/chapter1.fr.translation.xml',
          isDirectory: false,
        },
      ]),
      readFile: jest.fn().mockResolvedValue(sampleXml),
    } as unknown as typeof window.electronAPI;

    const { results } = await searchXPath({
      activeTabPath: null,
      openTabs: [],
      query: '//p',
      rootPath: '/proj',
      scope: 'project',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.filePath).toBe('/proj/chapter1.xml');
    expect(window.electronAPI.readFile).toHaveBeenCalledTimes(1);
  });

  test('refuses to search a translation file directly (currentFile scope)', async () => {
    window.electronAPI = { ...originalElectronAPI } as unknown as typeof window.electronAPI;

    const { results, error } = await searchXPath({
      activeTabPath: '/proj/chapter1.fr.translation.xml',
      openTabs: [
        { filePath: '/proj/chapter1.fr.translation.xml', content: '<translation/>' } as any,
      ],
      query: '//p',
      rootPath: '/proj',
      scope: 'currentFile',
    });

    expect(results).toHaveLength(0);
    expect(error).toMatch(/does not apply to translation files/);
  });
});

describe('searchXPath header filtering', () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  test('excludes teiHeader descendants from results in WYSIWYG mode', async () => {
    const xmlWithHeader = `<?xml version="1.0"?>
<TEI>
  <teiHeader>
    <fileDesc><sourceDesc><p>Header paragraph</p></sourceDesc></fileDesc>
  </teiHeader>
  <text><body>
    <p>Body one</p>
    <p>Body two</p>
  </body></text>
</TEI>`;

    window.electronAPI = {
      ...originalElectronAPI,
      readDirectory: jest.fn().mockResolvedValue([
        { name: 'chapter1.xml', path: '/proj/chapter1.xml', isDirectory: false },
      ]),
      readFile: jest.fn().mockResolvedValue(xmlWithHeader),
    } as unknown as typeof window.electronAPI;

    const { results } = await searchXPath({
      activeTabPath: null,
      openTabs: [],
      query: '//p',
      rootPath: '/proj',
      scope: 'project',
    });

    // window.writer is undefined in tests → not Source mode → header hits filtered.
    expect(results).toHaveLength(1);
    expect(results[0]?.matches).toHaveLength(2);
    for (const match of results[0]!.matches) {
      expect(match.xpath).not.toContain('teiHeader');
    }
  });
});
