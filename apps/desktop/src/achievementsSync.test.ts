jest.mock('electron', () => ({
  app: { getPath: () => '/tmp/ljb-test-userdata' },
}));

jest.mock('./projectPrefs', () => ({
  getAchievementsFolder: async () => null,
  getEntityDbFolder: async () => '/tmp/ljb-achievements-sync-test',
}));

jest.mock('./achievementsFile', () => {
  const actual = jest.requireActual<typeof import('./achievementsFile')>('./achievementsFile');
  return {
    ...actual,
    readAchievementsFileRaw: jest.fn(actual.readAchievementsFileRaw),
    writeAchievementsEnvelopeRaw: jest.fn(actual.writeAchievementsEnvelopeRaw),
    writeAchievementsFile: jest.fn(actual.writeAchievementsFile),
  };
});

import fs from 'node:fs/promises';
import { runAchievementsSync } from './achievementsSync';
import {
  readAchievementsFileRaw,
  writeAchievementsEnvelopeRaw,
  writeAchievementsFile,
} from './achievementsFile';
import { emptyState } from '../../commons/src/desktop/achievements/evaluate';

const readRaw = readAchievementsFileRaw as jest.MockedFunction<typeof readAchievementsFileRaw>;
const writeRaw = writeAchievementsEnvelopeRaw as jest.MockedFunction<
  typeof writeAchievementsEnvelopeRaw
>;
const writePlain = writeAchievementsFile as jest.MockedFunction<typeof writeAchievementsFile>;

const ENTITY_DIR = '/tmp/ljb-achievements-sync-test';

describe('runAchievementsSync', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    readRaw.mockImplementation(
      jest.requireActual<typeof import('./achievementsFile')>('./achievementsFile')
        .readAchievementsFileRaw,
    );
    writeRaw.mockImplementation(
      jest.requireActual<typeof import('./achievementsFile')>('./achievementsFile')
        .writeAchievementsEnvelopeRaw,
    );
    writePlain.mockImplementation(
      jest.requireActual<typeof import('./achievementsFile')>('./achievementsFile')
        .writeAchievementsFile,
    );
    await fs.rm(ENTITY_DIR, { recursive: true, force: true });
    await fs.mkdir(ENTITY_DIR, { recursive: true });
    await fs.rm('/tmp/ljb-test-userdata/entity-sync-achievements-marker.json', { force: true });
  });

  it('pushes a new local blob when the server is empty', async () => {
    await writePlain(JSON.stringify(emptyState('2026-01-01T00:00:00.000Z')));
    const localBlob = await readRaw();
    expect(localBlob).toBeTruthy();

    const client = {
      getAchievements: jest.fn().mockResolvedValue(null),
      putAchievements: jest
        .fn()
        .mockResolvedValue({ applied: true, revision: 1, sha256: 'deadbeef' }),
    };

    const result = await runAchievementsSync(client);
    expect(result).toEqual({ pulled: false, pushed: true, revision: 1 });
    expect(client.putAchievements).toHaveBeenCalledWith({
      baseRevision: 0,
      blob: localBlob,
    });
  });

  it('adopts a remote-only blob', async () => {
    await writePlain(JSON.stringify(emptyState('2026-01-01T00:00:00.000Z')));
    const remoteBlob = await readRaw();
    await fs.rm(`${ENTITY_DIR}/achievements.json`, { force: true });

    const client = {
      getAchievements: jest.fn().mockResolvedValue({
        revision: 1,
        blob: remoteBlob,
        sha256: 'aaa',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      putAchievements: jest.fn(),
    };

    const result = await runAchievementsSync(client);
    expect(await readRaw()).toBe(remoteBlob);
    expect(result.pulled).toBe(true);
    expect(client.putAchievements).not.toHaveBeenCalled();
  });

  it('merges on push conflict then retries', async () => {
    await writePlain(JSON.stringify({ ...emptyState('2026-01-01T00:00:00.000Z'), saveCount: 3 }));
    const localBlob = await readRaw();

    const serverState = { ...emptyState('2026-01-01T00:00:00.000Z'), saveCount: 9 };
    await writePlain(JSON.stringify(serverState));
    const serverBlob = await readRaw();
    await writePlain(JSON.stringify({ ...emptyState('2026-01-01T00:00:00.000Z'), saveCount: 3 }));

    const client = {
      getAchievements: jest.fn().mockResolvedValue(null),
      putAchievements: jest
        .fn()
        .mockResolvedValueOnce({
          conflict: true,
          serverRevision: 1,
          serverBlob: serverBlob!,
          serverSha256: 'bbb',
        })
        .mockResolvedValueOnce({ applied: true, revision: 2, sha256: 'ccc' }),
    };

    const result = await runAchievementsSync(client);
    expect(result.pushed).toBe(true);
    expect(client.putAchievements).toHaveBeenCalledTimes(2);
    expect(client.putAchievements).toHaveBeenNthCalledWith(1, {
      baseRevision: 0,
      blob: expect.any(String),
    });
  });
});
