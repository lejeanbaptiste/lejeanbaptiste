import fs from 'fs/promises';
import os from 'os';
import path from 'path';

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => os.tmpdir(),
  },
}));

jest.mock('./plugins', () => ({
  isPluginEnabledInMain: () => false,
}));

import { installCatalogSchema } from './schemaSetup';

describe('installCatalogSchema("cbeta")', () => {
  let projectDir: string;
  let projectFile: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cbeta-schema-'));
    projectFile = path.join(projectDir, 'jean-baptiste.project.json');
    await fs.writeFile(
      projectFile,
      JSON.stringify({ version: 1, name: 'Taishō test', projectId: 'test-id' }, null, 2),
    );
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  test('copies the bundled rng + css + schematron and records catalogId', async () => {
    const bundle = await installCatalogSchema(projectFile, 'cbeta');

    expect(bundle.config.schema).toMatchObject({
      rng: 'schema/cbeta_p5.rng',
      css: 'schema/cbeta.css',
      catalogId: 'cbeta',
      sourceUrl: 'bundled:cbeta_p5.rng',
      sourceCssUrl: 'bundled:cbeta.css',
    });
    expect(bundle.config.schema?.sourceHash).toMatch(/^[0-9a-f]{64}$/);

    const rng = await fs.readFile(path.join(projectDir, 'schema/cbeta_p5.rng'), 'utf-8');
    expect(rng).toContain('ljb-cbeta-loosen');
    await expect(fs.stat(path.join(projectDir, 'schema/cbeta.css'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(projectDir, 'schema/cbeta_p5.sch'))).resolves.toBeDefined();
  });

  test('writes nothing when the project file is missing', async () => {
    await expect(
      installCatalogSchema(path.join(projectDir, 'nope.project.json'), 'cbeta'),
    ).rejects.toThrow('Project file not found');
    await expect(fs.stat(path.join(projectDir, 'schema'))).rejects.toThrow();
  });

  test('rejects an unknown catalog id', async () => {
    await expect(installCatalogSchema(projectFile, 'nope')).rejects.toThrow(
      'Unknown catalog schema',
    );
  });
});
