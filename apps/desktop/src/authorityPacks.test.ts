import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readAuthorityPackFile } from './authorityPacks';

describe('readAuthorityPackFile date chunks', () => {
  it('reads intersecting chunks plus a two-block guard band, before IPC', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'grognard-pack-chunks-'));
    try {
      const dir = path.join(root, 'authority-packs', 'cbdb');
      await fs.mkdir(path.join(dir, 'persons'), { recursive: true });
      const chunks = [1, 201, 401, 601, 801, 1001].map((start) => ({
        path: `persons/${start}.ndjson`,
        start,
        end: start + 199,
      }));
      await fs.writeFile(
        path.join(dir, 'manifest.json'),
        JSON.stringify({
          files: { 'persons.ndjson': { dateChunks: { version: 1, blockYears: 200, chunks } } },
        }),
      );
      await Promise.all(
        chunks.map((chunk) =>
          fs.writeFile(path.join(dir, chunk.path), `${JSON.stringify({ id: chunk.start })}\n`),
        ),
      );

      const lines = await readAuthorityPackFile(root, 'cbdb-persons', {
        mode: 'limit',
        start: 450,
        end: 500,
      });
      expect(lines.map((line) => JSON.parse(line).id)).toEqual([1, 201, 401, 601, 801]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
