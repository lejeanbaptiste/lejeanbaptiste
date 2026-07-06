import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getChgisStatus, _setChgisBusyForTests } from './authorityChgis';

describe('authorityChgis', () => {
  it('reports not ready without entity database', async () => {
    const status = await getChgisStatus(null);
    expect(status.installed).toBe(false);
    expect(status.entityDbReady).toBe(false);
  });

  it('reports installed pack metadata', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chgis-status-'));
    try {
      fs.writeFileSync(path.join(dir, 'entities.xml'), '<listPerson/>');
      const packDir = path.join(dir, 'authority-packs', 'chgis');
      fs.mkdirSync(packDir, { recursive: true });
      fs.writeFileSync(
        path.join(packDir, 'manifest.json'),
        JSON.stringify({
          files: { 'places.ndjson': { entityCount: 42, crosswalkCount: 7 } },
          policy: { layers: ['v6_time_cnty_pts_utf'] },
          compiledAt: '2026-07-06T12:00:00.000Z',
        }),
      );
      fs.writeFileSync(path.join(packDir, 'places.ndjson'), '{"source":"CHGIS"}\n');

      const status = await getChgisStatus(dir);
      expect(status.installed).toBe(true);
      expect(status.placeCount).toBe(42);
      expect(status.crosswalkCount).toBe(7);
      expect(status.layers).toEqual(['v6_time_cnty_pts_utf']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks concurrent installs when busy', async () => {
    _setChgisBusyForTests(true);
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chgis-busy-'));
      try {
        fs.writeFileSync(path.join(dir, 'entities.xml'), '<listPerson/>');
        const { installChgisFromArchive } = await import('./authorityChgis');
        const result = await installChgisFromArchive({
          entityDbFolder: dir,
          archivePath: '/tmp/nope.zip',
        });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/already in progress/);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      _setChgisBusyForTests(false);
    }
  });
});
