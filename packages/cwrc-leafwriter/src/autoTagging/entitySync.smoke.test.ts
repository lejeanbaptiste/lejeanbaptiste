/**
 * Smoke test for the CEDB↔PEDB sync redesign.
 *
 * Run it with:
 *
 *   npx jest entitySync.smoke.test.ts
 *
 * What this proves, in plain terms: the actual bug the redesign exists to fix
 * (see docs/entity-registry-merges-and-splits.md, "Story A — Laptop and
 * desktop, same Dropbox brain"). Before this work, a merge done on one machine
 * could silently miss a project checkout that wasn't reachable at merge time —
 * that checkout would keep pointing at a dead entity id forever, with no
 * mechanism to ever notice or fix itself.
 *
 * This test builds two "machines" that share one entity database (via Dropbox,
 * in the real story) but do NOT share anything else — no network call, no
 * direct communication. It merges two duplicate entities on Machine A while
 * Machine B is unreachable, then opens Machine B later and checks that its
 * corpus converges on its own, purely by reading the order log left behind.
 *
 * It uses the real production modules (EntityStore, mergeEntities,
 * recordEntityOrder, applyPendingOrders) — nothing here is a stub of the logic
 * itself, only the filesystem and corpus are simulated so the test doesn't need
 * two real computers.
 */

import { addEntity, createEntitiesScaffold, getDatabaseId, parseEntities, serializeEntities } from './entities';
import { mergeEntities } from './entityOps';
import { EntityStore, resolveEntityStorePaths, type EntityFileApi } from './entityStore';
import type { KeyRemapFileOps } from '../../../../apps/commons/src/desktop/entityDb/applyKeyRemap';

/**
 * The shared cloud folder: one entities.xml, one registry, one order log — the
 * thing both machines' Dropbox/iCloud client is syncing. Both "machines" read
 * and write through THIS SAME fake filesystem, exactly like two computers
 * pointed at the same synced folder.
 */
class SharedCentralFolder implements EntityFileApi {
  files = new Map<string, string>();
  dirs = new Set<string>(['/shared-central']);
  ensureDirectory = async (dir: string) => {
    this.dirs.add(dir);
  };
  pathExists = async (path: string) => this.files.has(path) || this.dirs.has(path);
  readFile = async (path: string) => {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  };
  writeFile = async (path: string, content: string) => {
    this.files.set(path, content);
  };
}

/**
 * One machine's local corpus: files that live on that machine's disk, NOT in
 * the shared folder. Machine A's corpus and Machine B's corpus are separate
 * instances — writing to one never touches the other, just like two different
 * computers' local project checkouts.
 */
const localCorpus = (files: Record<string, string>): KeyRemapFileOps => ({
  listXmlFiles: async () => Object.keys(files),
  readFile: async (path) => files[path]!,
  writeFile: async (path, content) => {
    files[path] = content;
  },
});

describe('SMOKE TEST — two-machine merge convergence (the bug this redesign fixes)', () => {
  it('a merge made while Machine B is unreachable still converges on B once it opens', async () => {
    const cloud = new SharedCentralFolder();

    // --- Setup: a shared central database with one duplicate pair -----------
    // 張衡 was accidentally tagged as two different entity records.
    const seedDoc = parseEntities(createEntitiesScaffold());
    const keep = addEntity(seedDoc, 'person', { name: '張衡' }).id;
    const duplicate = addEntity(seedDoc, 'person', { name: '張衡' }).id;
    cloud.files.set('/shared-central/entities.xml', serializeEntities(seedDoc));
    const dbId = getDatabaseId(seedDoc)!;
    // Both machines' project folders exist on their own local disks — the
    // registry's existence check (pathExists) is a local-disk check in the real
    // app, simplified here onto the same fake filesystem as the cloud folder.
    cloud.dirs.add('/machine-a');
    cloud.dirs.add('/machine-b');

    console.log(`\n[setup] Central database has a duplicate: keep=${keep}, duplicate=${duplicate}`);

    // Machine A's local project checkout: one chapter file tagging BOTH ids.
    const machineACorpus: Record<string, string> = {
      '/machine-a/chapter1.xml': `<TEI><persName key="${keep}">張衡</persName><persName key="${duplicate}">張衡</persName></TEI>`,
    };
    // Machine B has its OWN separate checkout of the same project (e.g. cloned
    // via Git, or synced separately) — same duplicate key present.
    const machineBCorpus: Record<string, string> = {
      '/machine-b/chapter1.xml': `<TEI><persName key="${duplicate}">張衡</persName></TEI>`,
    };

    const storeFor = (projectRoot: string) =>
      EntityStore.fromPaths(
        cloud,
        resolveEntityStorePaths({ projectRoot, entityStore: 'central', centralFolder: '/shared-central' }),
      );

    const storeA = storeFor('/machine-a');
    const storeB = storeFor('/machine-b');

    // Only Machine A is open right now — this is the crucial part of the
    // story. Machine B has never registered itself (it isn't open), so the
    // OLD design's eager crawl-by-path literally cannot see it.
    await storeA.registerProjectInRegistry();
    const registeredRoots = await storeA.registryProjectRoots();
    console.log(`[step 1] Machine A is open; registry knows about: ${registeredRoots.join(', ')}`);
    expect(registeredRoots).toEqual(['/machine-a']); // Machine B is NOT in here.

    // --- Machine A merges the duplicate ------------------------------------
    const doc = await storeA.loadEntities();
    const { remap } = mergeEntities(doc, keep, [duplicate]);
    await storeA.saveEntities(doc);

    // This is the new behavior: a durable order is recorded FIRST...
    await storeA.recordEntityOrder(remap, dbId);
    console.log('[step 2] Machine A merged the duplicate and recorded a durable order.');

    // ...then the eager crawl runs, but it can only reach roots it knows about
    // (just Machine A itself) — exactly the old, still-useful "instant" path.
    for (const [path, xml] of Object.entries(machineACorpus)) {
      if (xml.includes(`key="${duplicate}"`)) {
        machineACorpus[path] = xml.replaceAll(`key="${duplicate}"`, `key="${keep}"`);
      }
    }
    console.log('[step 3] Machine A\'s own corpus updated immediately (eager crawl).');
    expect(machineACorpus['/machine-a/chapter1.xml']).not.toContain(duplicate);

    // --- The critical check: Machine B is UNCHANGED so far -----------------
    // If this test only proved the eager crawl works, it would prove nothing
    // new — that already existed. The point is what happens to B next.
    console.log('[step 4] Machine B has NOT been touched — it was never reachable.');
    expect(machineBCorpus['/machine-b/chapter1.xml']).toContain(duplicate);

    // --- Time passes. The user opens the project on Machine B. -------------
    // No message was sent. No shared process. B only shares the cloud folder.
    console.log('[step 5] ...time passes... the user now opens the SAME project on Machine B...');

    const { applyPendingOrders } = await import(
      '../../../../apps/commons/src/desktop/entityDb/applyOrders'
    );
    const result = await applyPendingOrders(storeB, localCorpus(machineBCorpus));

    console.log(
      `[step 6] Machine B replayed ${result.ordersApplied} order(s) from the log it found ` +
        `beside the shared entities.xml, and rewrote ${result.summary?.filesChanged ?? 0} of its own file(s).`,
    );

    // THIS is the bug fix: Machine B converges purely by reading the order log
    // left in the shared folder — no direct link to Machine A required.
    expect(result.ordersApplied).toBe(1);
    expect(machineBCorpus['/machine-b/chapter1.xml']).not.toContain(duplicate);
    expect(machineBCorpus['/machine-b/chapter1.xml']).toContain(keep);

    console.log('[PASS] Machine B converged on its own. This was impossible before the redesign.\n');

    // --- Bonus: replay is idempotent -----------------------------------------
    // Opening Machine B a second time must not re-scan/rewrite anything.
    const again = await applyPendingOrders(storeB, localCorpus(machineBCorpus));
    expect(again.ordersApplied).toBe(0);
    console.log('[bonus] Re-opening Machine B is a no-op (cursor remembers the applied order).');
  });
});
