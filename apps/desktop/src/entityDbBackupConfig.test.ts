const mockState = { decryptThrows: false, fileMissing: false };

jest.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (buffer: Buffer) => {
      // What a dismissed macOS keychain prompt looks like from here.
      if (mockState.decryptThrows) throw new Error('user denied keychain access');
      return buffer.toString();
    },
  },
}));

jest.mock('fs/promises', () => ({
  readFile: async () => {
    if (mockState.fileMissing) {
      const error: NodeJS.ErrnoException = new Error('ENOENT');
      error.code = 'ENOENT';
      throw error;
    }
    return Buffer.from(
      JSON.stringify({
        enabled: true,
        endpoint: 'https://example.r2.cloudflarestorage.com',
        accessKeyId: 'AK',
        secretAccessKey: 'SK',
        bucket: 'entities',
        prefix: 'entity-db-backups/',
        intervalMinutes: 15,
      }),
    );
  },
  mkdir: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
}));

import { readBackupConfigView } from './entityDbBackupConfig';

describe('readBackupConfigView', () => {
  beforeEach(() => {
    mockState.decryptThrows = false;
    mockState.fileMissing = false;
  });

  it('reports a readable config', async () => {
    const view = await readBackupConfigView();
    expect(view.enabled).toBe(true);
    expect(view.hasSecret).toBe(true);
    expect(view.credentialsLocked).toBe(false);
  });

  it('does not flag a machine that was never configured', async () => {
    mockState.fileMissing = true;
    const view = await readBackupConfigView();
    expect(view.enabled).toBe(false);
    expect(view.hasSecret).toBe(false);
    expect(view.credentialsLocked).toBe(false);
  });

  it('flags stored credentials that cannot be decrypted', async () => {
    mockState.decryptThrows = true;
    const view = await readBackupConfigView();
    // Blank like the unconfigured case, but the panel must say why instead of
    // silently showing an empty form while backups stay off.
    expect(view.enabled).toBe(false);
    expect(view.hasSecret).toBe(false);
    expect(view.credentialsLocked).toBe(true);
  });
});
