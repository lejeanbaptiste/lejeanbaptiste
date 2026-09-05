import fs from 'fs';
import path from 'path';

import {
  ENABLED_CATALOG_IDS,
  MORE_CATALOG_IDS,
  SCHEMA_CATALOG,
  getCatalogEntry,
} from './schemaCatalog';

describe('schema catalog — CBETA P5', () => {
  test('cbeta is an enabled "more" catalog entry', () => {
    expect(MORE_CATALOG_IDS).toContain('cbeta');
    expect(ENABLED_CATALOG_IDS).toContain('cbeta');
  });

  test('cbeta entry uses the tei mapping and ships bundled', () => {
    const entry = getCatalogEntry('cbeta');
    expect(entry).toBeDefined();
    expect(entry?.mapping).toBe('tei');
    expect(entry?.name).toBe('CBETA P5');
    expect(entry?.bundled).toEqual({
      rng: 'cbeta_p5.rng',
      css: 'cbeta.css',
      extra: ['cbeta_p5.sch'],
    });
  });

  test('every bundled file named by the entry exists in resources/schema', () => {
    const entry = SCHEMA_CATALOG.cbeta!;
    const dir = path.join(__dirname, '../resources/schema');
    for (const name of [entry.bundled!.rng, entry.bundled!.css, ...(entry.bundled!.extra ?? [])]) {
      expect(fs.existsSync(path.join(dir, name))).toBe(true);
    }
  });

  test('bundled cbeta_p5.rng carries the Grognard loosen marker', () => {
    const rng = fs.readFileSync(path.join(__dirname, '../resources/schema/cbeta_p5.rng'), 'utf-8');
    expect(rng).toContain('ljb-cbeta-loosen');
  });
});
