import { dictionaryTag } from './dictionary';
import { parseLog } from './decisionLog';
import { EntityStore, type EntityFileApi } from './entityStore';
import { AutoTaggingSession, type WriterLike } from './integration';

const XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>張衡居洛陽，張衡造渾天儀。</p>
</body></text></TEI>`;

/** Minimal fake Writer: XML round-trip through loadDocumentXML, permissive schema. */
const makeWriter = (initial: string, forbid?: { parent: string; child: string }) => {
  let current = initial;
  const loads: string[] = [];
  const writer: WriterLike = {
    converter: { getDocumentContent: async () => current },
    loadDocumentXML: (xml: string) => {
      current = xml;
      loads.push(xml);
    },
    schemaManager: {
      isTagValidChildOfParent: (child, parent) =>
        !(forbid && parent === forbid.parent && child === forbid.child),
    },
  };
  return { writer, loads, getCurrent: () => current };
};

describe('AutoTaggingSession', () => {
  it('produces, applies, and reloads the editor with the tagged XML', async () => {
    const { writer, loads, getCurrent } = makeWriter(XML);
    const session = new AutoTaggingSession(writer);

    const doc = await session.getDocument();
    const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
    expect(suggestions).toHaveLength(2);

    const result = await session.apply(suggestions);
    expect(result.applied).toBe(2);
    expect(loads).toHaveLength(1);
    expect(getCurrent()).toContain('<persName>張衡</persName>居洛陽');
    expect(getCurrent()).toContain('<persName>張衡</persName>造渾天儀');
  });

  it('routes schema validity through the writer schemaManager', async () => {
    const { writer, loads } = makeWriter(XML, { parent: 'p', child: 'persName' });
    const session = new AutoTaggingSession(writer);

    const doc = await session.getDocument();
    const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
    const result = await session.apply(suggestions);

    expect(result.applied).toBe(0);
    expect(result.results.every((r) => r.outcome === 'schema-blocked')).toBe(true);
    expect(loads).toHaveLength(0); // nothing applied → no reload
  });

  it('reverts the last apply from its snapshot', async () => {
    const { writer, getCurrent } = makeWriter(XML);
    const session = new AutoTaggingSession(writer);

    const doc = await session.getDocument();
    const suggestions = dictionaryTag(doc, [{ string: '洛陽', tag: 'placeName' }], 'ignore');
    await session.apply(suggestions);
    expect(getCurrent()).toContain('<placeName>洛陽</placeName>');
    expect(session.canRevert).toBe(true);

    expect(session.revertLastApply()).toBe(true);
    expect(getCurrent()).not.toContain('<placeName>');
    expect(session.canRevert).toBe(false);
    expect(session.revertLastApply()).toBe(false);
  });

  it('supports partial apply across two rounds against the reloaded document', async () => {
    const { writer, getCurrent } = makeWriter(XML);
    const session = new AutoTaggingSession(writer);

    const doc = await session.getDocument();
    const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');

    // round 1: apply only the first; round 2: the second — its anchor must
    // survive the reload (document text unchanged, structure changed)
    const first = await session.apply([suggestions[0]!]);
    expect(first.applied).toBe(1);
    const second = await session.apply([suggestions[1]!]);
    expect(second.applied).toBe(1);

    expect(getCurrent()).toContain('<persName>張衡</persName>居洛陽');
    expect(getCurrent()).toContain('<persName>張衡</persName>造渾天儀');
  });

  it('focus returns false without an editor instead of throwing', async () => {
    const { writer } = makeWriter(XML);
    const session = new AutoTaggingSession(writer);
    const doc = await session.getDocument();
    const [suggestion] = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
    expect(session.focus(suggestion!)).toBe(false);
  });

  describe('decision logging', () => {
    const makeStore = () => {
      const files = new Map<string, string>();
      const api: EntityFileApi = {
        ensureDirectory: async () => {},
        pathExists: async (p) => files.has(p),
        readFile: async (p) => files.get(p) ?? '',
        writeFile: async (p, c) => {
          files.set(p, c);
        },
      };
      return { store: new EntityStore(api, '/proj'), files };
    };

    const suggestionFor = async (session: AutoTaggingSession, surface: string) => {
      const doc = await session.getDocument();
      return dictionaryTag(doc, [{ string: surface, tag: 'persName' }], 'ignore')[0]!;
    };

    it('buffers decisions and flushes them to /.leaf/entity-decisions.jsonl', async () => {
      const { writer } = makeWriter(XML);
      const { store, files } = makeStore();
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const s1 = await suggestionFor(session, '張衡');
      session.logDecision({ suggestion: s1, decision: 'accepted' });
      session.logDecision({ suggestion: s1, decision: 'rejected' });
      expect(session.pendingDecisionCount).toBe(2);

      const written = await session.flushDecisions();
      expect(written).toBe(2);
      expect(session.pendingDecisionCount).toBe(0);

      const body = files.get('/proj/.leaf/entity-decisions.jsonl')!;
      const records = parseLog(body);
      expect(records.map((r) => r.action)).toEqual(['accepted', 'rejected']);
      expect(records[0]).toMatchObject({ surface: '張衡', tag: 'persName', source: 'dictionary' });
    });

    it('clears the buffer even with no store (web app), writing nothing', async () => {
      const { writer } = makeWriter(XML);
      const session = new AutoTaggingSession(writer, 'ignore', null);
      const s1 = await suggestionFor(session, '張衡');
      session.logDecision({ suggestion: s1, decision: 'accepted' });

      expect(await session.flushDecisions()).toBe(1);
      expect(session.pendingDecisionCount).toBe(0);
    });
  });
});
