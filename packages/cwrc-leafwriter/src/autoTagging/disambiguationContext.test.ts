import { coMentionedNamesInBlock, formatDisambiguationRankContext } from './disambiguationContext';
import { extractDocumentDateRange, parseTeiYear } from './documentDateRange';
import type { DisambiguationCandidate } from './disambiguationCandidates';
import { buildDocIndex, createAnchor } from './anchor';
import type { MentionInstance } from './mentions';

describe('documentDateRange', () => {
  it('parses leading years from TEI date values', () => {
    expect(parseTeiYear('405-03-01')).toBe(405);
    expect(parseTeiYear('618')).toBe(618);
    expect(parseTeiYear('-0050-01-01')).toBe(-50);
  });

  it('extracts min/max from date elements', () => {
    const doc = new DOMParser().parseFromString(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
        <p><date when="405-03-01">義熙元年三月</date></p>
        <p><date when="412">義熙八年</date></p>
      </body></text></TEI>`,
      'application/xml',
    );
    expect(extractDocumentDateRange(doc)).toEqual({ start: 405, end: 412 });
  });
});

describe('disambiguationContext', () => {
  const doc = new DOMParser().parseFromString(
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><date when="618">year</date> <persName key="person_000001">Taizong</persName> met <persName>Weizheng</persName>.</p></body></text></TEI>`,
    'application/xml',
  );

  const persNames = () => Array.from(doc.getElementsByTagName('persName'));

  const findPersName = (surface: string) => {
    const hit = persNames().find((el) => el.textContent?.trim() === surface);
    if (!hit) throw new Error(`persName ${surface} not found`);
    return hit;
  };

  it('collects co-mentioned names in the same block', () => {
    const target = findPersName('Weizheng');
    const index = buildDocIndex(doc, 'ignore');
    const instance: MentionInstance = {
      documentId: 'test.xml',
      tag: 'persName',
      surface: 'Weizheng',
      element: target,
      hasKey: false,
      isUnresolved: false,
      anchor: createAnchor('test.xml', doc.documentElement, target.firstChild as Text, 0, 2, 'ignore', index),
    };

    const co = coMentionedNamesInBlock(instance);
    expect(co).toEqual([
      { surface: 'Taizong', tag: 'persName', entityKey: 'person_000001' },
    ]);
  });

  it('formats context with document dates and co-mentions', () => {
    const target = findPersName('Weizheng');
    const index = buildDocIndex(doc, 'ignore');
    const instance: MentionInstance = {
      documentId: 'test.xml',
      tag: 'persName',
      surface: 'Weizheng',
      element: target,
      hasKey: false,
      isUnresolved: false,
      anchor: createAnchor('test.xml', doc.documentElement, target.firstChild as Text, 0, 2, 'ignore', index),
    };
    const candidates: DisambiguationCandidate[] = [
      { id: 'wd:Q123', label: 'Weizheng', description: 'Tang minister', sources: ['Wikidata'] },
    ];
    const text = formatDisambiguationRankContext({
      tag: instance.tag,
      surface: instance.surface,
      contextBefore: instance.anchor.contextBefore,
      contextAfter: instance.anchor.contextAfter,
      documentDateRange: extractDocumentDateRange(doc),
      coMentionedNames: coMentionedNamesInBlock(instance),
      candidates,
    });
    expect(text).toContain('618–618 CE');
    expect(text).toContain('Taizong');
    expect(text).toContain('id=wd:Q123');
  });
});
