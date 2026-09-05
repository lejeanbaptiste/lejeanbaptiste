import { crawlEntities } from './crawl';
import { dictionaryTag } from './dictionary';
import { parseLog } from './decisionLog';
import { addEntity, createEntitiesScaffold } from './entities';
import {
  attachAuthority,
  addEntityName,
  getFamilyName,
  getGivenName,
  setFamilyName,
  setGivenName,
  setRomanizedName,
  setUserEntityDate,
} from './entityOps';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import { collectTextNodes, createAnchor } from './anchor';
import { AutoTaggingSession, reconcilePersonWrapperKeys, type WriterLike } from './integration';
import type { AuthorityPackId } from './packPaths';
import { groupWrapperCandidateSuggestions } from './wrapperCandidates';
import type { WrapperFactRecord } from './wrapperFactsLog';
import {
  clearPluginEntityDataExtractor,
  registerPluginEntityDataExtractor,
} from '../plugins/entityDataExtractors';

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
  it('runs a text-preserving transform through the session boundary', async () => {
    const { writer, getCurrent } = makeWriter(
      '<root><p><persName key="B">劉備</persName></p></root>',
    );
    writer.overmindState = { editor: { resource: { filePath: 'current' } } };
    (window as unknown as { writer: WriterLike }).writer = writer;
    const session = new AutoTaggingSession(writer);
    const result = await session.runTagTransform({
      string: '劉備',
      tagName: 'persName',
      replaceKey: { name: 'key', value: 'A' },
      scope: 'currentFile',
    });
    expect(result).toEqual({ filesChanged: 1, matches: 1 });
    expect(getCurrent()).toContain('key="A"');
  });

  it('auto-resolves a wrapper and its inner person from one local entity match', async () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><name type="personWrapper"><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName>範</persName></name></p></body></text></TEI>',
      'application/xml',
    );
    expect(
      await reconcilePersonWrapperKeys(doc, async (surface) =>
        surface === '範' ? ['person-7'] : [],
      ),
    ).toBe(true);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    const person = doc.getElementsByTagName('persName')[0]!;
    expect(wrapper.getAttribute('key')).toBe('person-7');
    expect(person.getAttribute('key')).toBe('person-7');
    expect(wrapper.hasAttribute('cert')).toBe(false);
  });

  it('leaves wrappers unresolved when an existing key is not a live person entity', async () => {
    const doc = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><name type="personWrapper" key="missing"><persName key="missing">範</persName></name></p></body></text></TEI>',
      'application/xml',
    );
    expect(
      await reconcilePersonWrapperKeys(
        doc,
        () => [],
        () => false,
      ),
    ).toBe(true);
    expect(doc.getElementsByTagName('name')[0]!.getAttribute('cert')).toBe('unknown');
  });

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
      editor: {
        setContentHasChanged: (value) => {
          contentHasChanged = value;
        },
      },
      project: {
        markTabDirty: (dirty) => {
          tabDirty = dirty;
        },
        updateTabContent: ({ content }) => {
          storedContent = content;
        },
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
      isTagValidChildOfParent: (child, parent) => parent === 'p' && child === 'persName',
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

  describe('wrapper-candidate auto-key via harvested facts', () => {
    const WRAPPER_XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>陳郡謝超宗為政。</p></body></text></TEI>`;

    const makeFactStore = (seedFacts: WrapperFactRecord[] = []) => {
      const files = new Map<string, string>();
      if (seedFacts.length > 0) {
        files.set(
          '/proj/.grognard/wrapper-facts.jsonl',
          `${seedFacts.map((fact) => JSON.stringify(fact)).join('\n')}\n`,
        );
      }
      const api: EntityFileApi = {
        ensureDirectory: async () => undefined,
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

    it('auto-keys a wrapper candidate from a previously harvested project fact, without touching Norbert', async () => {
      const { writer, getCurrent } = makeWriter(WRAPPER_XML);
      const { store } = makeFactStore([
        {
          when: '2026-01-01T00:00:00Z',
          query: { persName: '謝超宗', originPlace: '陳郡' },
          entityId: 'entity-existing',
        },
      ]);
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const doc = await session.getDocument();
      const [placeName, persName] = dictionaryTag(
        doc,
        [
          { string: '陳郡', tag: 'placeName' },
          { string: '謝超宗', tag: 'persName' },
        ],
        'ignore',
      );
      const { groups } = groupWrapperCandidateSuggestions([placeName!, persName!]);
      expect(groups).toHaveLength(1);

      const result = await session.apply([groups[0]!.suggestion]);
      expect(result.applied).toBe(3); // placeName + persName + the wrap

      const parsed = new DOMParser().parseFromString(getCurrent(), 'application/xml');
      const wrapper = parsed.getElementsByTagName('name')[0]!;
      expect(wrapper.getAttribute('type')).toBe('personWrapper');
      expect(wrapper.getAttribute('key')).toBe('entity-existing');
      expect(wrapper.getAttribute('cert')).toBeNull();
      expect(wrapper.getElementsByTagName('persName')[0]!.getAttribute('key')).toBe(
        'entity-existing',
      );
      expect(wrapper.getElementsByTagName('placeName')[0]!.textContent).toBe('陳郡');
    });

    it('does not record a duplicate fact when the project already knew the combination', async () => {
      const { writer } = makeWriter(WRAPPER_XML);
      const seed: WrapperFactRecord = {
        when: '2026-01-01T00:00:00Z',
        query: { persName: '謝超宗', originPlace: '陳郡' },
        entityId: 'entity-existing',
      };
      const { store } = makeFactStore([seed]);
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const doc = await session.getDocument();
      const [placeName, persName] = dictionaryTag(
        doc,
        [
          { string: '陳郡', tag: 'placeName' },
          { string: '謝超宗', tag: 'persName' },
        ],
        'ignore',
      );
      const { groups } = groupWrapperCandidateSuggestions([placeName!, persName!]);
      await session.apply([groups[0]!.suggestion]);

      expect(await store.readWrapperFacts()).toEqual([seed]);
    });

    it('intakes the wrapper structured content into SQLite immediately on auto-key', async () => {
      registerPluginEntityDataExtractor('test-origin-extractor', ({ wrapper }) => {
        const place = Array.from(wrapper.getElementsByTagName('placeName')).find(
          (el) => el.parentElement === wrapper,
        );
        const value = place?.textContent?.trim();
        return value ? [{ element: 'placeName', value }] : [];
      });
      try {
        const { writer } = makeWriter(WRAPPER_XML);
        const { store } = makeFactStore([
          {
            when: '2026-01-01T00:00:00Z',
            query: { persName: '謝超宗', originPlace: '陳郡' },
            entityId: 'entity-existing',
          },
        ]);
        const reconcileSpy = jest
          .spyOn(store, 'sqliteReconcileXmlExtractedData')
          .mockResolvedValue({ wrappers: 1, added: 1, removed: 0, retained: 0 });
        const session = new AutoTaggingSession(writer, 'ignore', store);

        const doc = await session.getDocument();
        const [placeName, persName] = dictionaryTag(
          doc,
          [
            { string: '陳郡', tag: 'placeName' },
            { string: '謝超宗', tag: 'persName' },
          ],
          'ignore',
        );
        const { groups } = groupWrapperCandidateSuggestions([placeName!, persName!]);
        await session.apply([groups[0]!.suggestion]);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        const [call] = reconcileSpy.mock.calls;
        expect(call![0]).toMatchObject({
          wrappers: [
            {
              entityId: 'entity-existing',
              assertions: [{ element: 'placeName', value: '陳郡' }],
            },
          ],
        });
      } finally {
        clearPluginEntityDataExtractor('test-origin-extractor');
      }
    });
  });

  describe('getProjectDocuments', () => {
    interface DesktopGlobals {
      electronAPI?: {
        listProjectXmlFiles: (root: string) => Promise<{ name: string; path: string }[]>;
        readFile: (path: string) => Promise<string>;
      };
      __ljbLspProject?: { projectRoot?: string };
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
    }

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
      const surfaces = documents.flatMap((doc) =>
        crawlEntities(doc, 'ignore').map((e) => e.string),
      );
      expect(surfaces).toContain('甲');
      expect(surfaces).toContain('乙');
      expect(surfaces).not.toContain('舊');
    });
  });

  describe('runTagBomb', () => {
    interface DesktopGlobals {
      electronAPI?: {
        listProjectXmlFiles: (root: string) => Promise<{ name: string; path: string }[]>;
        readFile: (path: string) => Promise<string>;
      };
      __ljbLspProject?: { projectRoot?: string };
      writer?: { overmindState?: { editor?: { resource?: { filePath?: string } } } };
    }

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

    it('merges a file pack, project-tag crawl, and an imported list into one result', async () => {
      const liveXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>張衡居洛陽，張衡造渾天儀。</p>
</body></text></TEI>`;
      const otherXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><placeName>洛陽</placeName></p>
</body></text></TEI>`;

      const { writer } = makeWriter(liveXml);
      win.electronAPI = {
        listProjectXmlFiles: async () => [{ name: 'other.xml', path: '/proj/other.xml' }],
        readFile: async (path) => {
          if (path === '/proj/other.xml') return otherXml;
          throw new Error(`unexpected read: ${path}`);
        },
      };
      win.__ljbLspProject = { projectRoot: '/proj' };
      win.writer = { overmindState: { editor: { resource: { filePath: '/proj/current.xml' } } } };

      const session = new AutoTaggingSession(writer);

      const dilaPack = JSON.stringify({
        source: 'DILA',
        authorityId: 'zhang-heng',
        kind: 'person',
        primaryName: '張衡',
        searchStrings: ['張衡'],
      });
      const readPackFile = async () => dilaPack;

      const result = await session.runTagBomb(
        ['dila-persons', 'project-places', 'list-works'],
        readPackFile,
        {
          importedLists: [{ name: 'my.csv', entries: [{ string: '渾天儀', tag: 'title' }] }],
        },
      );

      const byTag = (tag: string) => result.suggestions.filter((s) => s.tag === tag);
      expect(byTag('persName')).toHaveLength(2); // 張衡 appears twice
      expect(byTag('placeName')).toHaveLength(1); // 洛陽, from the project crawl
      expect(byTag('title')).toHaveLength(1); // 渾天儀, from the imported list
      expect(result.suggestions.every((s) => s.status === 'pending')).toBe(true);
    });

    it('loads the Wikidata zh-hant place pack through the normal tag-bomb path', async () => {
      const { writer } = makeWriter(
        `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>洛陽是都城。</p></body></text></TEI>`,
      );
      const session = new AutoTaggingSession(writer);

      const wikidataPlacesPack = JSON.stringify({
        source: 'Wikidata',
        authorityId: 'Q123456',
        kind: 'place',
        primaryName: '洛陽',
        searchStrings: ['洛陽', '洛阳'],
        metadata: { description: 'Historical Chinese place', subtype: 'place' },
      });
      const readPackFile = async (packId: AuthorityPackId) => {
        if (packId === 'wikidata-places-zh-hant') return wikidataPlacesPack;
        throw new Error(`unexpected pack read: ${packId}`);
      };

      const result = await session.runTagBomb(['wikidata-places-zh-hant'], readPackFile);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]?.tag).toBe('placeName');
      expect(result.suggestions[0]?.anchor.surface).toBe('洛陽');
      expect(result.loaded['wikidata-places-zh-hant']).toBe(1);
    });
  });

  describe('decision logging', () => {
    const XML_NS = 'http://www.w3.org/XML/1998/namespace';

    const makeStore = () => {
      const files = new Map<string, string>();
      const api: EntityFileApi = {
        ensureDirectory: async () => undefined,
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

    /** Mark `.sqlite` present and mirror typed SQLite writes into sibling XML for assertions. */
    const wireSqliteLookupWrites = (store: EntityStore, files: Map<string, string>) => {
      files.set('/proj/entities.sqlite', 'sqlite-placeholder');
      if (!files.has('/proj/entities.xml')) {
        files.set('/proj/entities.xml', createEntitiesScaffold());
      }
      const g = globalThis as { window?: { electronAPI?: Record<string, unknown> } };
      g.window = g.window ?? { electronAPI: {} };
      g.window.electronAPI = {
        ...(g.window.electronAPI ?? {}),
        entitySqliteCreatePopulated: async () => ({}),
        entitySqliteAttachAuthority: async () => true,
        entitySqliteReconcileXmlExtractedData: async () => ({
          wrappers: 0,
          added: 0,
          removed: 0,
          retained: 0,
        }),
      };

      jest.spyOn(store, 'sqliteCreatePopulated').mockImplementation(async (input) => {
        const doc = await store.loadEntities();
        const primary = input.names?.find((name) => name.isPrimary) ??
          input.names?.[0] ?? { text: 'unnamed' };
        const romanized = input.names?.find(
          (name) => name !== primary && name.text !== primary.text,
        );
        const { element } = addEntity(doc, input.kind, {
          name: primary.text,
          nameLang: primary.language ?? undefined,
          romanizedName: romanized?.text,
          description: input.description ?? undefined,
          authorityIds: (input.authorities ?? []).map((a) => ({ type: a.type, value: a.value })),
        });
        element.setAttributeNS(XML_NS, 'xml:id', input.id);
        if (input.familyName) setFamilyName(doc, input.id, input.familyName);
        if (input.givenName) setGivenName(doc, input.id, input.givenName);
        await store.saveEntities(doc, { allowSqliteFullReimport: true });
        return {};
      });

      jest
        .spyOn(store, 'sqliteAttachAuthority')
        .mockImplementation(async (entityId, type, value) => {
          const doc = await store.loadEntities();
          const attached = attachAuthority(doc, entityId, { type, value });
          await store.saveEntities(doc, { allowSqliteFullReimport: true });
          return attached;
        });

      jest
        .spyOn(store, 'sqliteSetUserDate')
        .mockImplementation(async ({ entityId, part, year }) => {
          const doc = await store.loadEntities();
          setUserEntityDate(doc, entityId, part, year);
          await store.saveEntities(doc, { allowSqliteFullReimport: true });
        });

      jest.spyOn(store, 'sqliteAddNationality').mockImplementation(async (input) => {
        const doc = await store.loadEntities();
        const person = Array.from(doc.getElementsByTagName('person')).find(
          (el) => el.getAttribute('xml:id') === input.entityId,
        );
        if (person) {
          const nationality = doc.createElementNS('http://www.tei-c.org/ns/1.0', 'nationality');
          nationality.textContent = input.label;
          if (input.source) nationality.setAttribute('source', input.source);
          person.appendChild(nationality);
          await store.saveEntities(doc, { allowSqliteFullReimport: true });
        }
        return true;
      });
      jest.spyOn(store, 'sqliteAddOrigin').mockImplementation(async () => true);
      jest
        .spyOn(store, 'sqliteSetRomanizedName')
        .mockImplementation(async (entityId, text, language) => {
          const doc = await store.loadEntities();
          setRomanizedName(doc, entityId, text, language ?? undefined);
          await store.saveEntities(doc, { allowSqliteFullReimport: true });
        });
      jest.spyOn(store, 'sqliteAddName').mockImplementation(async (input) => {
        const doc = await store.loadEntities();
        addEntityName(doc, input.entityId, input.text, {
          lang: input.language ?? undefined,
          type: input.nameType ?? undefined,
        });
        if (input.nameType === 'family') setFamilyName(doc, input.entityId, input.text);
        if (input.nameType === 'given') setGivenName(doc, input.entityId, input.text);
        await store.saveEntities(doc, { allowSqliteFullReimport: true });
        return true;
      });
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const suggestionFor = async (session: AutoTaggingSession, surface: string) => {
      const doc = await session.getDocument();
      return dictionaryTag(doc, [{ string: surface, tag: 'persName' }], 'ignore')[0]!;
    };

    it('buffers decisions and flushes them to /.grognard/entity-decisions.jsonl', async () => {
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

      const body = files.get('/proj/.grognard/entity-decisions.jsonl')!;
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
      const { store, files } = makeStore();
      wireSqliteLookupWrites(store, files);
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
      const entityId = await session.resolveMention(
        instance,
        {
          id: 'new',
          label: '張衡',
          sources: ['manual'],
        },
        { createNew: true },
      );

      expect(getCurrent()).toContain(`key="${entityId}"`);
      expect(files.get('/proj/entities.xml')).toContain(entityId);
    });

    it('enriches family/given and typed short forms from pack names at link', async () => {
      const { store, files } = makeStore();
      wireSqliteLookupWrites(store, files);
      const { writer } = makeWriter(XML);
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const doc = await session.getDocument();
      const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
      await session.apply(suggestions);

      const groups = await session.scanMentions();
      const instance = groups.find((item) => item.surface === '張衡')?.instances[0];
      if (!instance) throw new Error('missing mention instance');

      const entityId = await session.resolveMention(
        instance,
        {
          id: 'new',
          label: '張衡',
          sources: ['CBDB'],
          authorityIds: [{ type: 'CBDB', value: '376' }],
          typedNames: [
            { text: '張', type: 'family' },
            { text: '衡', type: 'given' },
            { text: '平子', type: 'courtesy' },
          ],
        },
        { createNew: true },
      );

      const entitiesDoc = new DOMParser().parseFromString(
        files.get('/proj/entities.xml')!,
        'application/xml',
      );
      expect(getFamilyName(entitiesDoc, entityId)).toBe('張');
      expect(getGivenName(entitiesDoc, entityId)).toBe('衡');
      const person = Array.from(entitiesDoc.getElementsByTagName('person')).find(
        (el) => el.getAttribute('xml:id') === entityId,
      )!;
      const nameTexts = Array.from(person.getElementsByTagName('persName')).map(
        (el) => el.textContent,
      );
      expect(nameTexts).toEqual(expect.arrayContaining(['平子', '張', '衡']));
    });

    it('writes distinct per-source elements when the candidate carries authorityAssertions', async () => {
      const { store, files } = makeStore();
      wireSqliteLookupWrites(store, files);
      const { writer, getCurrent } = makeWriter(XML);
      const session = new AutoTaggingSession(writer, 'ignore', store);

      const doc = await session.getDocument();
      const suggestions = dictionaryTag(doc, [{ string: '張衡', tag: 'persName' }], 'ignore');
      await session.apply(suggestions);
      expect(getCurrent()).toContain('<persName>張衡</persName>');

      const groups = await session.scanMentions();
      const group = groups.find((item) => item.surface === '張衡');
      const instance = group!.instances[0];
      if (!instance) throw new Error('missing mention instance');

      const entityId = await session.resolveMention(instance, {
        id: 'new',
        label: '張衡',
        sources: ['CBDB', 'DILA'],
        authorityAssertions: [
          {
            id: 'cbdb-1',
            label: '張衡',
            sources: ['CBDB'],
            authorityIds: [{ type: 'CBDB', value: '1' }],
            startYear: 78,
            authorityMetadata: {
              nationality: [{ id: 'han', canonicalId: 'dynasty:han', label: 'Han' }],
            },
          },
          {
            id: 'dila-1',
            label: '張衡',
            sources: ['DILA'],
            authorityIds: [{ type: 'DILA', value: 'A1' }],
            startYear: 79,
            authorityMetadata: {
              nationality: [{ id: 'han', canonicalId: 'dynasty:han', label: 'Han' }],
            },
          },
        ],
      });

      const savedDoc = new DOMParser().parseFromString(
        files.get('/proj/entities.xml')!,
        'application/xml',
      );
      const person = Array.from(savedDoc.getElementsByTagName('person')).find(
        (el) => el.getAttribute('xml:id') === entityId,
      )!;
      // SQLite user-date writes collapse to one birth row (not per-source XML
      // elements); nationalities still land once per authority source.
      expect(person.getElementsByTagName('birth').length).toBeGreaterThanOrEqual(1);
      const nationalities = Array.from(person.getElementsByTagName('nationality'));
      expect(nationalities).toHaveLength(2);
      expect(nationalities.map((n) => n.getAttribute('source')).sort()).toEqual(['CBDB', 'DILA']);
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

  it('applyTagBombDocument("current") uses the live editor, never readFile("current")', async () => {
    const { writer, getCurrent } = makeWriter(XML);
    writer.overmindState = { editor: { resource: { filePath: '/project/a.xml' } } };
    (window as unknown as { writer: WriterLike }).writer = writer;

    const readFile = jest.fn(async () => {
      throw new Error('readFile should not be called for the current sentinel');
    });
    const previousApi = (window as unknown as { electronAPI?: unknown }).electronAPI;
    (
      window as unknown as { electronAPI: { readFile: typeof readFile; writeFile: jest.Mock } }
    ).electronAPI = {
      readFile,
      writeFile: jest.fn(),
    };

    try {
      const session = new AutoTaggingSession(writer);
      const doc = await session.getDocument();
      const nodes = collectTextNodes(doc, 'ignore');
      const node = nodes.find((n) => n.search.text.includes('張衡'))!.node;
      const idx = nodes.find((n) => n.node === node)!.search.text.indexOf('張衡');
      const rawStart = nodes.find((n) => n.node === node)!.search.map[idx]!;
      const suggestion = {
        id: 'add_1',
        source: 'authority' as const,
        action: 'add' as const,
        tag: 'persName',
        anchor: createAnchor('doc', doc, node, rawStart, rawStart + '張衡'.length, 'ignore'),
        status: 'accepted' as const,
      };
      const result = await session.applyTagBombDocument('current', [suggestion]);
      expect(readFile).not.toHaveBeenCalled();
      expect(result.applied).toBe(1);
      expect(getCurrent()).toContain('<persName>');
    } finally {
      (window as unknown as { electronAPI?: unknown }).electronAPI = previousApi;
    }
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
      loadDocumentXML: () => undefined,
    };
    const session = new AutoTaggingSession(writer);
    const doc = await session.getDocument();
    expect(doc.documentElement.localName).toBe('TEI');
    delete window.__desktopStoredDocumentXml;
  });
});
