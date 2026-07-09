/**
 * @jest-environment jsdom
 */
import { localSchemaToBlobUrl } from './fetchResource';

const WRAPPER_URL = 'https://example.test/schema/tei_all.rng';
const CORE_URL = 'https://example.test/schema/tei_all.tei.rng';

const WRAPPER_XML = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="tei_all.tei.rng"><define name="date"><element name="date"><ref name="ljb.sanmiao.era"/></element></define></include><define name="ljb.sanmiao.era"><element name="era"><text/></element></define></grammar>`;
const CORE_XML = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="date"><element name="date"><ref name="model.phrase"/></element></define><define name="persName"><element name="persName"/></define></grammar>`;

describe('localSchemaToBlobUrl include override merge', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn(async (url: string) => {
      const body = url === WRAPPER_URL ? WRAPPER_XML : url === CORE_URL ? CORE_XML : null;
      if (body === null) return { status: 404, text: async () => '' };
      return { status: 200, text: async () => body };
    });
    // jsdom's Blob doesn't implement .text()/.arrayBuffer(); capture the raw
    // string passed into the Blob constructor instead.
    (URL as any).createObjectURL = jest.fn(() => 'blob:mock');
  });

  it('applies the override define nested inside <include> instead of discarding it', async () => {
    const OriginalBlob = global.Blob;
    let captured = '';
    (global as any).Blob = jest.fn((parts: string[]) => {
      captured = parts.join('');
      return new OriginalBlob(parts);
    });

    await localSchemaToBlobUrl(WRAPPER_URL);
    const text = captured;
    global.Blob = OriginalBlob;

    const merged = new DOMParser().parseFromString(text, 'application/xml');
    const dateDefines = Array.from(merged.querySelectorAll('define[name="date"]'));

    // Exactly one `date` define must survive the merge (the override), not
    // both the override and the stock upstream one appended alongside it.
    expect(dateDefines).toHaveLength(1);
    // The override (with the sanmiao era ref) must win over the stock TEI
    // core's `date` (with model.phrase) — previously includeEl.remove()
    // silently discarded the override and the stock upstream define was
    // appended unchanged instead.
    expect(dateDefines[0]!.querySelector('ref[name="ljb.sanmiao.era"]')).not.toBeNull();
    expect(dateDefines[0]!.querySelector('ref[name="model.phrase"]')).toBeNull();
    expect(text).toContain('persName');
    expect(text).not.toContain('<include');
  });

  it('passes through already-flat local schemas without merging', async () => {
    const FLAT_URL = 'https://example.test/schema/flat.rng';
    const FLAT_XML = `<?xml version="1.0"?><grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="date"><element name="date"><ref name="ljb.sanmiao.era"/></element></define></grammar>`;

    (global as any).fetch = jest.fn(async (url: string) => {
      if (url === FLAT_URL) return { status: 200, text: async () => FLAT_XML };
      return { status: 404, text: async () => '' };
    });

    const OriginalBlob = global.Blob;
    let captured = '';
    (global as any).Blob = jest.fn((parts: string[]) => {
      captured = parts.join('');
      return new OriginalBlob(parts);
    });

    await localSchemaToBlobUrl(FLAT_URL);
    global.Blob = OriginalBlob;

    expect(captured).toBe(FLAT_XML);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });
});
