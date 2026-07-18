import JSZip from 'jszip';
import { setActiveProjectBundle } from './activeProjectBundle';
import { exportDocument } from './documentExport';

const bundle = {
  config: { version: 1 as const, name: 'test' },
  projectFilePath: '/proj/jean-baptiste.project.json',
  rootPath: '/proj',
};

const translationSettingsJson = JSON.stringify({
  version: 1,
  alignmentUnit: 'p',
  languages: [{ code: 'fr', label: 'Français' }],
  lockedAt: new Date().toISOString(),
});

const sourceXml =
  '<TEI><text><body>' +
  '<p xml:id="p1">Hello world.</p>' +
  '</body></text></TEI>';

const translationXml =
  '<translation><text><body>' +
  '<p corresp="chapter1.xml#p1">Bonjour le monde.' +
  '<note place="foot">Cf. <bibl type="zotero-ref" corresp="#zbib-ABCD1234">Brown 2020</bibl>.</note>' +
  '</p>' +
  '</body></text>' +
  '<standOff><listBibl type="zotero">' +
  '<bibl xml:id="zbib-ABCD1234" corresp="http://zotero.org/users/1/items/ABCD1234">' +
  '<note type="csl-json" resp="zotero"><![CDATA[{"id":"ABCD1234","type":"book","title":"Empire under the Night Sky","author":[{"family":"Brown","given":"Alice"}],"issued":{"date-parts":[[2020]]}}]]></note>' +
  '</bibl>' +
  '</listBibl></standOff>' +
  '</translation>';

describe('exportDocument', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    setActiveProjectBundle(bundle as any);
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn(async (filePath: string) => {
        if (filePath === '/proj/schema/translation-settings.json') return translationSettingsJson;
        if (filePath === '/proj/chapter1.fr.translation.xml') return translationXml;
        throw new Error('ENOENT');
      }),
      statFile: jest.fn(async (filePath: string) => {
        if (filePath === '/proj/chapter1.fr.translation.xml') return { mtimeMs: 1, size: 1 };
        throw new Error('ENOENT');
      }),
    } as unknown as typeof window.electronAPI;
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    setActiveProjectBundle(null);
  });

  test('exports source-only text when translations are not requested', async () => {
    const result = await exportDocument({
      format: 'text',
      sourceXml,
      sourcePath: '/proj/chapter1.xml',
      includeTranslations: false,
      includeBibliography: false,
    });
    expect(result.extension).toBe('txt');
    expect(result.content).toBe('Hello world.');
  });

  test('interleaves the translation and reconstitutes the Zotero citation as a live RTF field', async () => {
    const result = await exportDocument({
      format: 'rtf',
      sourceXml,
      sourcePath: '/proj/chapter1.xml',
      includeTranslations: true,
      translationLang: 'fr',
      includeBibliography: false,
    });

    expect(result.extension).toBe('rtf');
    expect(result.content).toContain('Hello world.');
    expect(result.content).toContain('Bonjour le monde.');
    expect(result.content).toContain('ADDIN ZOTERO_ITEM CSL_CITATION');
    expect(result.content).toContain('Empire under the Night Sky');
  });

  test('renders a References section from the CSL bibliography for markdown', async () => {
    const result = await exportDocument({
      format: 'markdown',
      sourceXml,
      sourcePath: '/proj/chapter1.xml',
      includeTranslations: true,
      translationLang: 'fr',
      includeBibliography: true,
    });

    expect(result.content).toContain('## References');
    expect(result.content).toContain('Brown');
    expect(result.content).toContain('_Empire under the Night Sky_');
  });

  test('produces a docx Blob with a live Zotero footnote citation', async () => {
    const result = await exportDocument({
      format: 'docx',
      sourceXml,
      sourcePath: '/proj/chapter1.xml',
      includeTranslations: true,
      translationLang: 'fr',
      includeBibliography: true,
    });

    expect(result.extension).toBe('docx');
    expect(result.content).toBeInstanceOf(Blob);

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(result.content as Blob);
    });
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const footnotesXml = await zip.file('word/footnotes.xml')!.async('string');

    expect(documentXml).toContain('Hello world.');
    expect(documentXml).toContain('Bonjour le monde.');
    expect(documentXml).toContain('References');
    expect(documentXml).toContain('<w:footnotePr><w:pos w:val="docEnd"/></w:footnotePr>');
    expect(footnotesXml).toContain('w:fldSimple');
    expect(footnotesXml).toContain('Empire under the Night Sky');
  });

  test('produces an odt Blob with a live Zotero reference-mark citation', async () => {
    const result = await exportDocument({
      format: 'odt',
      sourceXml,
      sourcePath: '/proj/chapter1.xml',
      includeTranslations: true,
      translationLang: 'fr',
      includeBibliography: true,
    });

    expect(result.extension).toBe('odt');
    expect(result.content).toBeInstanceOf(Blob);

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(result.content as Blob);
    });
    const zip = await JSZip.loadAsync(arrayBuffer);
    const contentXml = await zip.file('content.xml')!.async('string');

    expect(contentXml).toContain('Hello world.');
    expect(contentXml).toContain('Bonjour le monde.');
    expect(contentXml).toContain('References');
    expect(contentXml).toContain('text:reference-mark-start text:name="ZOTERO_ITEM CSL_CITATION');
    expect(contentXml).toContain('Empire under the Night Sky');
  });
});
