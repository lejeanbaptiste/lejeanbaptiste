import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let appDataDir: string;
let userDataDir: string;

jest.mock('electron', () => ({
  app: {
    getPath: (key: string) => (key === 'appData' ? appDataDir : userDataDir),
  },
}));

import { migrateLegacyUserData } from './userDataMigration';

const LEGACY = 'Le Jean-Baptiste';
const MARKER = '.migrated-from-lejeanbaptiste.json';

beforeEach(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'grognard-migration-'));
  appDataDir = root;
  userDataDir = path.join(root, 'Grognard');
});

afterEach(async () => {
  await fs.rm(appDataDir, { recursive: true, force: true });
});

const seedLegacy = async (files: Record<string, string>) => {
  const legacy = path.join(appDataDir, LEGACY);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(legacy, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents);
  }
  return legacy;
};

const readMarker = async () =>
  JSON.parse(await fs.readFile(path.join(userDataDir, MARKER), 'utf8'));

describe('migrateLegacyUserData', () => {
  it('copies the legacy profile into the new userData dir', async () => {
    await seedLegacy({
      'project-prefs.json': '{"recent":[]}',
      'entity-database/main.sqlite': 'DB',
      'plugins/norbert/manifest.json': '{}',
    });

    migrateLegacyUserData();

    expect(await fs.readFile(path.join(userDataDir, 'project-prefs.json'), 'utf8')).toBe(
      '{"recent":[]}',
    );
    expect(await fs.readFile(path.join(userDataDir, 'entity-database/main.sqlite'), 'utf8')).toBe(
      'DB',
    );
    expect(await fs.readFile(path.join(userDataDir, 'plugins/norbert/manifest.json'), 'utf8')).toBe(
      '{}',
    );
    const marker = await readMarker();
    expect(marker).toMatchObject({ ok: true, migrated: true });
  });

  it('leaves the legacy directory intact (copy, not move)', async () => {
    const legacy = await seedLegacy({ 'project-prefs.json': '{}' });
    migrateLegacyUserData();
    expect(await fs.readFile(path.join(legacy, 'project-prefs.json'), 'utf8')).toBe('{}');
  });

  it('skips regenerable caches and Chromium scratch', async () => {
    await seedLegacy({
      'project-prefs.json': '{}',
      'kanripo-cache/x.xml': '<TEI/>',
      'GPUCache/data': 'x',
      'plugin-cache/norbert/y': 'y',
    });

    migrateLegacyUserData();

    expect(await fs.readFile(path.join(userDataDir, 'project-prefs.json'), 'utf8')).toBe('{}');
    await expect(fs.access(path.join(userDataDir, 'kanripo-cache'))).rejects.toThrow();
    await expect(fs.access(path.join(userDataDir, 'GPUCache'))).rejects.toThrow();
    await expect(fs.access(path.join(userDataDir, 'plugin-cache'))).rejects.toThrow();
    expect((await readMarker()).skipped).toEqual(
      expect.arrayContaining(['kanripo-cache', 'GPUCache', 'plugin-cache']),
    );
  });

  it('is idempotent — a second call does not re-copy', async () => {
    await seedLegacy({ 'project-prefs.json': '{"v":1}' });
    migrateLegacyUserData();

    await fs.writeFile(path.join(userDataDir, 'project-prefs.json'), '{"v":2}');
    migrateLegacyUserData();

    expect(await fs.readFile(path.join(userDataDir, 'project-prefs.json'), 'utf8')).toBe('{"v":2}');
  });

  it('records a marker and does nothing when there is no legacy profile', async () => {
    migrateLegacyUserData();
    expect(await readMarker()).toMatchObject({
      ok: true,
      migrated: false,
      reason: 'no legacy profile',
    });
  });

  it('does not overwrite an already-populated new profile', async () => {
    await seedLegacy({ 'project-prefs.json': '{"from":"legacy"}' });
    await fs.mkdir(userDataDir, { recursive: true });
    await fs.writeFile(path.join(userDataDir, 'project-prefs.json'), '{"from":"new"}');

    migrateLegacyUserData();

    expect(await fs.readFile(path.join(userDataDir, 'project-prefs.json'), 'utf8')).toBe(
      '{"from":"new"}',
    );
    expect(await readMarker()).toMatchObject({
      migrated: false,
      reason: 'new profile already populated',
    });
  });
});
