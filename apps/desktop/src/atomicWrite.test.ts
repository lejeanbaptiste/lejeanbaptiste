import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { recoverFromFailedAtomicWrite, writeFileAtomic } from './atomicWrite';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ljb-atomic-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('creates a new file', async () => {
    const filePath = path.join(dir, 'prefs.json');
    await writeFileAtomic(filePath, '{"a":1}');
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"a":1}');
  });

  it('replaces an existing file without leaving .tmp behind', async () => {
    const filePath = path.join(dir, 'prefs.json');
    await fs.writeFile(filePath, '{"a":1}', 'utf-8');
    await writeFileAtomic(filePath, '{"a":2}');
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"a":2}');
    await expect(fs.access(`${filePath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(`${filePath}.bak`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('recoverFromFailedAtomicWrite', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ljb-atomic-recover-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('promotes a leftover .tmp when the destination is missing', async () => {
    const filePath = path.join(dir, 'project-prefs.json');
    await fs.writeFile(`${filePath}.tmp`, '{"recovered":true}', 'utf-8');
    expect(await recoverFromFailedAtomicWrite(filePath)).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"recovered":true}');
  });

  it('promotes a leftover .bak when the destination and .tmp are missing', async () => {
    const filePath = path.join(dir, 'project-prefs.json');
    await fs.writeFile(`${filePath}.bak`, '{"fromBak":true}', 'utf-8');
    expect(await recoverFromFailedAtomicWrite(filePath)).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"fromBak":true}');
  });

  it('prefers .tmp over .bak when both leftovers exist', async () => {
    const filePath = path.join(dir, 'project-prefs.json');
    await fs.writeFile(`${filePath}.bak`, '{"old":true}', 'utf-8');
    await fs.writeFile(`${filePath}.tmp`, '{"new":true}', 'utf-8');
    expect(await recoverFromFailedAtomicWrite(filePath)).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"new":true}');
  });

  it('does nothing when the destination already exists', async () => {
    const filePath = path.join(dir, 'project-prefs.json');
    await fs.writeFile(filePath, '{"ok":true}', 'utf-8');
    await fs.writeFile(`${filePath}.tmp`, '{"stale":true}', 'utf-8');
    expect(await recoverFromFailedAtomicWrite(filePath)).toBe(false);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('{"ok":true}');
  });
});
