/**
 * End-to-end smoke test for the auto-tagging + entity-file stack (Phases 0–3),
 * run against a real project document. Not a unit test — it wires the whole
 * pipeline together the way the app does and prints a readable trace.
 *
 *   npx jest --selectProjects Core smoke
 *
 * Skips gracefully if the sample corpus isn't present.
 */
import fs from 'fs';
import path from 'path';
import { crawlEntities } from './crawl';
import { parseLog } from './decisionLog';
import { dictionaryTag } from './dictionary';
import { addEntity, findEntity, TAG_TO_KIND } from './entities';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import { AutoTaggingSession, type WriterLike } from './integration';

/** In-memory stand-in for the desktop file API. */
class FakeFs implements EntityFileApi {
  files = new Map<string, string>();
  ensureDirectory = async () => {};
  pathExists = async (p: string) => this.files.has(p);
  readFile = async (p: string) => this.files.get(p) ?? '';
  writeFile = async (p: string, c: string) => void this.files.set(p, c);
}

/** Fake Writer that round-trips XML through loadDocumentXML. */
const makeWriter = (xml: string) => {
  let current = xml;
  const writer: WriterLike = {
    converter: { getDocumentContent: async () => current },
    loadDocumentXML: (next: string) => {
      current = next;
    },
    schemaManager: { isTagValidChildOfParent: () => true },
  };
  return { writer, getCurrent: () => current };
};

const xmlPath = path.resolve(__dirname, '../../../../test_project/sizhu_shang.xml');
const maybe = fs.existsSync(xmlPath) ? it : it.skip;

describe('auto-tagging smoke test (real corpus)', () => {
  maybe('crawl → tag → apply → entity file → decision log', async () => {
    const source = fs.readFileSync(xmlPath, 'utf-8');
    const fakeFs = new FakeFs();
    const store = EntityStore.fromPaths(
      fakeFs,
      resolveEntityStorePaths({ projectRoot: '/proj', entityStore: 'project' }),
    );
    const { writer, getCurrent } = makeWriter(source);
    const session = new AutoTaggingSession(writer, 'ignore', store);

    // 1. Crawl the document for names already tagged, build a dictionary.
    const doc = await session.getDocument();
    const crawled = crawlEntities(doc, 'ignore').filter((e) => [...e.string].length > 1);
    expect(crawled.length).toBeGreaterThan(0);

    // 2. Produce suggestions for untagged occurrences of those names.
    const suggestions = dictionaryTag(doc, crawled, 'ignore', 'this document');
    expect(suggestions.length).toBeGreaterThan(0);

    // 3. Review: accept the first half, reject the rest — logging each decision.
    const half = Math.ceil(suggestions.length / 2);
    const accepted = suggestions.slice(0, half);
    for (const s of accepted) session.logDecision({ suggestion: s, decision: 'accepted' });
    for (const s of suggestions.slice(half)) session.logDecision({ suggestion: s, decision: 'rejected' });

    // 4. Apply the accepted suggestions to the document.
    const result = await session.apply(accepted);
    expect(result.applied).toBeGreaterThan(0);
    expect(getCurrent()).not.toBe(source); // the document changed
    expect(getCurrent().length).toBeGreaterThan(source.length); // tags were added

    // 5. Seed the entity file from one crawled person (Phase 4 will do this in bulk).
    const entitiesDoc = await store.loadEntities();
    const samplePerson = crawled.find((e) => e.tag === 'persName')!;
    const { id } = addEntity(entitiesDoc, TAG_TO_KIND[samplePerson.tag]!, {
      name: samplePerson.string,
      authorityIds: [{ type: 'CBDB', value: '0000' }],
    });
    await store.saveEntities(entitiesDoc);
    const reloaded = await store.loadEntities();
    expect(findEntity(reloaded, id)?.getElementsByTagName('persName')[0]?.textContent).toBe(
      samplePerson.string,
    );

    // 6. Flush decisions to the JSONL log and read them back.
    const written = await session.flushDecisions();
    expect(written).toBe(suggestions.length);
    const logBody = fakeFs.files.get('/proj/.ljb/entity-decisions.jsonl')!;
    const records = parseLog(logBody);
    expect(records).toHaveLength(suggestions.length);

    expect(store.entitiesPath).toBe('/proj/entities.xml');
    expect(store.decisionsPath).toBe('/proj/.ljb/entity-decisions.jsonl');

    // Readable trace.
    const applied = result.applied;
    const alreadyTagged = result.results.filter((r) => r.outcome === 'already-tagged').length;
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '── auto-tagging smoke test ─────────────────────────────',
        `  corpus:            ${path.basename(xmlPath)}`,
        `  names crawled:     ${crawled.length}`,
        `  suggestions:       ${suggestions.length} (untagged occurrences)`,
        `  accepted / applied:${accepted.length} / ${applied}`,
        `  already-tagged:    ${alreadyTagged}`,
        `  entity minted:     ${id} (${samplePerson.string})`,
        `  decisions logged:  ${records.length} → /proj/.ljb/entity-decisions.jsonl`,
        `  entity file:       /proj/entities.xml (${entitiesDoc.getElementsByTagName('person').length} person)`,
        '────────────────────────────────────────────────────────',
      ].join('\n'),
    );
  });
});
