import {
  readProjectRegistry,
  registerProject,
  registryPathFor,
  resolveProjectRoots,
} from './entityProjectRegistry';
import type { EntityFileApi } from './entityStore';

/** In-memory fake covering files and directories. */
class FakeFs implements EntityFileApi {
  files = new Map<string, string>();
  dirs = new Set<string>();
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

const ENTITIES = '/central/entities.xml';

describe('registryPathFor', () => {
  it('is a sibling of entities.xml', () => {
    expect(registryPathFor('/central/entities.xml')).toBe('/central/entity-projects.json');
    expect(registryPathFor('C:\\data\\entities.xml')).toBe('C:\\data\\entity-projects.json');
  });
});

describe('registerProject', () => {
  it('creates the registry on first check-in', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');

    const roots = await registerProject(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a']);
    expect(await readProjectRegistry(fs, ENTITIES)).toEqual(['/proj/a']);
  });

  it('does not duplicate an already-registered root', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');

    await registerProject(fs, ENTITIES, '/proj/a');
    const roots = await registerProject(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a']);
  });

  it('keeps roots not visible from this machine (roaming fix: no destructive prune)', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');
    fs.dirs.add('/proj/other-machine');
    // another machine's checkout registered itself, then isn't mounted here
    await registerProject(fs, ENTITIES, '/proj/other-machine');
    fs.dirs.delete('/proj/other-machine');

    // registering our own project must NOT drop the other machine's entry
    const roots = await registerProject(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/other-machine', '/proj/a']);
    // it stays persisted for the other machine to keep using
    expect(await readProjectRegistry(fs, ENTITIES)).toEqual(['/proj/other-machine', '/proj/a']);
  });

  it('survives a corrupt registry file', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');
    fs.files.set(registryPathFor(ENTITIES), 'not json {');

    const roots = await registerProject(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a']);
  });
});

describe('resolveProjectRoots', () => {
  it('unions the current project with existing registered roots', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');
    fs.dirs.add('/proj/b');
    await registerProject(fs, ENTITIES, '/proj/b');

    const roots = await resolveProjectRoots(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a', '/proj/b']);
  });

  it('skips registered roots that vanished from disk', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/proj/a');
    fs.dirs.add('/proj/b');
    await registerProject(fs, ENTITIES, '/proj/b');
    fs.dirs.delete('/proj/b');

    const roots = await resolveProjectRoots(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a']);
  });

  it('dedupes the current root against the registry case-insensitively', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/Proj/A');
    fs.dirs.add('/proj/a');
    await registerProject(fs, ENTITIES, '/Proj/A');

    const roots = await resolveProjectRoots(fs, ENTITIES, '/proj/a');
    expect(roots).toEqual(['/proj/a']);
  });
});
