import { resolveCurrentDocumentXml, type DocumentContentReader } from './documentContent';

const XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Test</p></body></text></TEI>`;
const XML_WITH_PB = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>丹<pb n="663"/>陽</p></body></text></TEI>`;
const XML_FLATTENED = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>丹陽</p></body></text></TEI>`;

describe('resolveCurrentDocumentXml', () => {
  afterEach(() => {
    delete window.__desktopStoredDocumentXml;
    delete window.__desktopMergeHeaderForValidation;
    delete (window as { writer?: { overmindState?: { ui?: { editorViewMode?: string } } } }).writer;
  });

  it('returns converter output when available', async () => {
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => XML },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(XML);
  });

  it('prefers stored snapshot in visual mode even when the converter succeeds', async () => {
    window.__desktopStoredDocumentXml = XML_WITH_PB;
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => XML_FLATTENED },
      overmindState: { ui: { editorViewMode: 'visual' } },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(XML_WITH_PB);
  });

  it('prefers the source buffer in source mode', async () => {
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => XML_FLATTENED },
      overmindState: {
        ui: { editorViewMode: 'source', sourceCurrentContent: XML_WITH_PB },
      },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(XML_WITH_PB);
  });

  it('falls back to stored desktop XML when converter throws', async () => {
    window.__desktopStoredDocumentXml = XML;
    const reader: DocumentContentReader = {
      converter: {
        getDocumentContent: async () => {
          throw new Error('no root element found');
        },
      },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(XML);
  });

  it('falls back to overmind document xml when converter returns empty', async () => {
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => '' },
      overmindState: { document: { xml: XML } },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(XML);
  });

  it('merges desktop header when merge helper is present', async () => {
    const merged = '<TEI><teiHeader/><text><body><p>Test</p></body></text></TEI>';
    window.__desktopMergeHeaderForValidation = () => merged;
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => '<text><body><p>Test</p></body></text>' },
    };
    await expect(resolveCurrentDocumentXml(reader)).resolves.toBe(merged);
  });

  it('throws when no source is available', async () => {
    const reader: DocumentContentReader = {
      converter: {
        getDocumentContent: async () => {
          throw new Error('no root element found');
        },
      },
    };
    await expect(resolveCurrentDocumentXml(reader)).rejects.toThrow(
      'AutoTaggingSession: could not read the current document',
    );
  });
});
