import { crawlEntities } from './crawl';
import { dictionaryTag } from './dictionary';
import { parseLog } from './decisionLog';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import { collectTextNodes, createAnchor } from './anchor';
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

  it('marks the document unsaved after apply', async () => {
    let contentHasChanged = false;
    let tabDirty = false;
    let storedContent: string | undefined;
    const { writer, getCurrent } = makeWriter(XML);
    writer.overmindActions = {
      editor: { setContentHasChanged: (value) => { contentHasChanged = value; } },
      project: {
        markTabDirty: (dirty) => { tabDirty = dirty; },
        updateTabContent: ({ content }) => { storedContent = content; },
      },
    };
    writer.overmindState = {
      editor: { resource: { filePath: '/project/doc.xml' } },
    };

    const session = new AutoTaggingSession(writer);
    const doc = await session.getDocument();
    const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
    await session.apply(suggestions);

    expect(contentHasChanged).toBe(true);
    expect(tabDirty).toBe(true);
    expect(storedContent).toContain('<persName>張衡</persName>');
    expect(getCurrent()).toContain('<persName>張衡</persName>');
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

  it('allows date in p when schema lists persName but not date', async () => {
    const dateXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>少帝即位</p></body></text></TEI>`;
    const { writer, loads, getCurrent } = makeWriter(dateXml);
    writer.schemaManager = {
      isTagValidChildOfParent: (child, parent) =>
        parent === 'p' && child === 'persName',
    };
    const session = new AutoTaggingSession(writer);
    const doc = await session.getDocument();
    const [{ node, search }] = collectTextNodes(doc, 'ignore');
    const surface = '少帝即位';
    const idx = search.text.indexOf(surface);
    const rawStart = search.map[idx]!;
    const rawEnd = search.map[idx + surface.length - 1]! + 1;
    const suggestion = {
      id: 'date-1',
      source: 'dates' as const,
      action: 'add' as const,
      tag: 'date',
      anchor: createAnchor('doc', doc, node, rawStart, rawEnd, 'ignore'),
      status: 'pending' as const,
    };

    const result = await session.apply([suggestion]);

    expect(result.applied).toBe(1);
    expect(loads).toHaveLength(1);
    expect(getCurrent()).toContain('<date>少帝即位</date>');
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

  describe('getProjectDocuments', () => {
    type DesktopGlobals = {
      electronAPI?: {
        listProjectXmlFiles: (root: string) => Promise<{ name: string; path: string }[]>;
        readFile: (path: string) => Promise<string>;
      };
      __ljbLspProject?: { projectRoot?: string };
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
    };

    const win = window as unknown as DesktopGlobals;
    let savedElectron: DesktopGlobals['electronAPI'];
    let savedProject: DesktopGlobals['__ljbLspProject'];
    let savedWriter: DesktopGlobals['writer'];

    beforeEach(() => {
      savedElectron = win.electronAPI;
      savedProject = win.__ljbLspProject;
      savedWriter = win.writer;
      delete win.electronAPI;
      delete win.__ljbLspProject;
      delete win.writer;
    });

    afterEach(() => {
      if (savedElectron === undefined) delete win.electronAPI;
      else win.electronAPI = savedElectron;
      if (savedProject === undefined) delete win.__ljbLspProject;
      else win.__ljbLspProject = savedProject;
      if (savedWriter === undefined) delete win.writer;
      else win.writer = savedWriter;
    });

    it('returns only the live document when desktop project APIs are absent', async () => {
      const { writer } = makeWriter(XML);
      const session = new AutoTaggingSession(writer);

      const { documents, available } = await session.getProjectDocuments();

      expect(available).toBe(false);
      expect(documents).toHaveLength(1);
      expect(crawlEntities(documents[0]!, 'ignore')).toHaveLength(0);
    });

    it('merges other project XML but skips the active file on disk', async () => {
      const liveXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><persName>甲</persName></p>
</body></text></TEI>`;
      const otherXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><persName>乙</persName></p>
</body></text></TEI>`;
      const staleDiskXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><persName>舊</persName></p>
</body></text></TEI>`;

      const { writer } = makeWriter(liveXml);
      win.electronAPI = {
        listProjectXmlFiles: async () => [
          { name: 'current.xml', path: '/proj/current.xml' },
          { name: 'other.xml', path: '/proj/other.xml' },
        ],
        readFile: async (path) => {
          if (path === '/proj/current.xml') return staleDiskXml;
          if (path === '/proj/other.xml') return otherXml;
          throw new Error(`unexpected read: ${path}`);
        },
      };
      win.__ljbLspProject = { projectRoot: '/proj' };
      win.writer = {
        overmindState: { editor: { resource: { filePath: '/proj/current.xml' } } },
      };

      const session = new AutoTaggingSession(writer);
      const { documents, available } = await session.getProjectDocuments();

      expect(available).toBe(true);
      expect(documents).toHaveLength(2);
      const surfaces = documents.flatMap((doc) => crawlEntities(doc, 'ignore').map((e) => e.string));
      expect(surfaces).toContain('甲');
      expect(surfaces).toContain('乙');
      expect(surfaces).not.toContain('舊');
    });
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
      return {
        store: EntityStore.fromPaths(
          api,
          resolveEntityStorePaths({ projectRoot: '/proj', entityStore: 'project' }),
        ),
        files,
      };
    };

    const suggestionFor = async (session: AutoTaggingSession, surface: string) => {
      const doc = await session.getDocument();
      return dictionaryTag(doc, [{ string: surface, tag: 'persName' }], 'ignore')[0]!;
    };

    it('buffers decisions and flushes them to /.ljb/entity-decisions.jsonl', async () => {
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

      const body = files.get('/proj/.ljb/entity-decisions.jsonl')!;
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

    it('resolves a tagged mention to @key and writes the entity file', async () => {
      const files = new Map<string, string>();
      const api = {
        ensureDirectory: async (dir: string) => {
          files.set(dir, '');
        },
        pathExists: async (path: string) => files.has(path),
        readFile: async (path: string) => files.get(path) ?? '',
        writeFile: async (path: string, content: string) => {
          files.set(path, content);
        },
      };
      const paths = resolveEntityStorePaths({
        projectRoot: '/proj',
        entityStore: 'project',
      });
      const store = EntityStore.fromPaths(api, paths);
      const { writer, getCurrent } = makeWriter(XML);
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const doc = await session.getDocument();
      const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
      await session.apply(suggestions);
      expect(getCurrent()).toContain('<persName>張衡</persName>');

      const groups = await session.scanMentions();
      const group = groups.find((item) => item.surface === '張衡');
      expect(group?.instances.length).toBeGreaterThan(0);

      const instance = group!.instances[0];
      if (!instance) throw new Error('missing mention instance');
      const entityId = await session.resolveMention(instance, {
        id: 'new',
        label: '張衡',
        sources: ['manual'],
      }, { createNew: true });

      expect(getCurrent()).toContain(`key="${entityId}"`);
      expect(files.get('/proj/entities.xml')).toContain(entityId);
    });
  });

  it('applies audit remove suggestions through the session', async () => {
    const tagged = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><persName>張衡</persName>居<placeName>洛陽</placeName>。</p>
</body></text></TEI>`;
    const { writer, getCurrent } = makeWriter(tagged);
    const session = new AutoTaggingSession(writer);

    const doc = await session.getDocument();
    const { collectTextNodes, createAnchor } = await import('./anchor');
    const nodes = collectTextNodes(doc, 'ignore');
    const persNode = nodes.find((n) => n.search.text.includes('張衡'))!.node;
    const idx = nodes.find((n) => n.node === persNode)!.search.text.indexOf('張衡');
    const rawStart = nodes.find((n) => n.node === persNode)!.search.map[idx]!;
    const rawEnd = rawStart + '張衡'.length;

    const removeSuggestion = {
      id: 'audit_remove_1',
      source: 'ai' as const,
      action: 'remove' as const,
      tag: 'persName',
      anchor: createAnchor('doc', doc, persNode, rawStart, rawEnd, 'ignore'),
      status: 'pending' as const,
    };

    const result = await session.apply([removeSuggestion]);
    expect(result.applied).toBe(1);
    expect(getCurrent()).toContain('張衡居');
    expect(getCurrent()).not.toContain('<persName>張衡</persName>');
    expect(getCurrent()).toContain('<placeName>洛陽</placeName>');
  });

  it('falls back to stored XML when the converter cannot read the editor body', async () => {
    window.__desktopStoredDocumentXml = XML;
    const writer: WriterLike = {
      converter: {
        getDocumentContent: async () => {
          throw new Error(
            'Could not convert the document to XML: no root element found (schema root: TEI).',
          );
        },
      },
      loadDocumentXML: () => {},
    };
    const session = new AutoTaggingSession(writer);
    const doc = await session.getDocument();
    expect(doc.documentElement.localName).toBe('TEI');
    delete window.__desktopStoredDocumentXml;
  });
});
