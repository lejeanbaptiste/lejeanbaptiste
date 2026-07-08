jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import SchemaManager from './schemaManager';
import { fetchResourceText } from '../../utilities';

jest.mock('../../utilities', () => {
  const actual = jest.requireActual('../../utilities');
  return { ...actual, fetchResourceText: jest.fn() };
});

const mockFetch = fetchResourceText as jest.Mock;

const WRAPPER_XML = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="tei_all.tei.rng"><define name="date"><element name="date"/></define></include></grammar>`;
const CORE_XML = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="date"><element name="date"/></define><define name="persName"><element name="persName"/></define></grammar>`;

const WRAPPER_URL = 'ljb://%2Fproj%2Fschema%2Ftei_all.rng';
const CORE_URL = 'ljb://%2Fproj%2Fschema%2Ftei_all.tei.rng';

const fakeWriter = {
  appDisplayName: 'Test',
  event: () => ({ subscribe: () => {}, unsubscribe: () => {} }),
  utilities: { stringToXML: (s: string) => new DOMParser().parseFromString(s, 'text/xml') },
} as any;

describe('SchemaManager include loading', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: string) => {
      if (url === WRAPPER_URL) return WRAPPER_XML;
      if (url === CORE_URL) return CORE_XML;
      return null;
    });
  });

  it('fetches the include target even when documentSchemaUrl equals the wrapper URL', async () => {
    const manager = new SchemaManager(fakeWriter, []);

    // Reproduces production sequencing: a document was opened, associating
    // documentSchemaUrl with the project's own wrapper schema (see
    // xml2cwrc.ts calling setDocumentSchemaUrl). This persists on the
    // SchemaManager instance across project switches within the same session.
    manager.setDocumentSchemaUrl(WRAPPER_URL);

    // Simulate the top-level schema fetch (sets manager.rng to the wrapper URL).
    const schemaXML = await (manager as any).loadSchemaFile([WRAPPER_URL]);
    (manager as any).schemaXML = schemaXML;

    const include = (globalThis as any).$
      ? undefined
      : undefined;
    // Use jQuery the same way schemaManager.loadSchema does.
    const $ = require('jquery');
    const includeEl = $('include:first', schemaXML);
    expect(includeEl.length).toBe(1);

    await (manager as any).loadIncludes({ rng: [WRAPPER_URL] }, includeEl);

    const mergedXML = new XMLSerializer().serializeToString(schemaXML);
    expect(mergedXML).toContain('persName');
    expect(mergedXML).not.toContain('<include');
  });
});
