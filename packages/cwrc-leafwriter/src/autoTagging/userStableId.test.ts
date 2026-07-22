import type { EntityFileApi } from './entityStore';
import { readOrMintUserStableId, USER_ID_FILE } from './userStableId';

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

const ID_FILE = `/central/${USER_ID_FILE}`;

describe('readOrMintUserStableId', () => {
  it('mints and persists an id on first use', async () => {
    const fs = new FakeFs();
    const result = await readOrMintUserStableId(fs, '/central');
    expect(result.minted).toBe(true);
    expect(result.id).toBeTruthy();
    expect(fs.files.get(ID_FILE)?.trim()).toBe(result.id);
  });

  it('returns the same id on the second call (stable across machines via the folder)', async () => {
    const fs = new FakeFs();
    const first = await readOrMintUserStableId(fs, '/central');
    const second = await readOrMintUserStableId(fs, '/central');
    expect(second.minted).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it('re-mints when the stored file is blank', async () => {
    const fs = new FakeFs();
    fs.files.set(ID_FILE, '   \n');
    const result = await readOrMintUserStableId(fs, '/central');
    expect(result.minted).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it('returns a session-local id without touching disk when no folder is set', async () => {
    const fs = new FakeFs();
    const result = await readOrMintUserStableId(fs, null);
    expect(result.minted).toBe(false);
    expect(result.id).toBeTruthy();
    expect(fs.files.size).toBe(0);
  });
});
