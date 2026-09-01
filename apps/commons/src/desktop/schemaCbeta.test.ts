import { buildProjectSchemas } from './projectFile';
import { MORE_CATALOG_IDS, getTieredCatalogForSetup } from './schemaCatalog';
import type { ProjectFileConfig } from './projectTypes';

const baseConfig = (schema: ProjectFileConfig['schema']): ProjectFileConfig => ({
  version: 1,
  name: 'Taishō test',
  schema,
});

describe('CBETA P5 schema wiring', () => {
  test('cbeta appears in the schema-setup "more" tier', () => {
    expect(MORE_CATALOG_IDS).toContain('cbeta');
    const { more } = getTieredCatalogForSetup();
    expect(more.map((entry) => entry.id)).toContain('cbeta');
    expect(more.find((entry) => entry.id === 'cbeta')?.name).toBe('CBETA P5');
  });

  test('buildProjectSchemas gives a cbeta project the tei mapping and a readable name', () => {
    const [schema] = buildProjectSchemas(
      '/projects/taisho',
      baseConfig({ rng: 'schema/cbeta_p5.rng', css: 'schema/cbeta.css', catalogId: 'cbeta' }),
    );

    expect(schema).toMatchObject({ name: 'CBETA P5', mapping: 'tei', editable: true });
    expect(schema.rng[0]).toContain('cbeta_p5.rng');
    expect(schema.css[0]).toContain('cbeta.css');
  });

  test('a cbeta project without an explicit css still resolves to a local schema entry', () => {
    const [schema] = buildProjectSchemas(
      '/projects/taisho',
      baseConfig({ rng: 'schema/cbeta_p5.rng', catalogId: 'cbeta' }),
    );
    expect(schema.mapping).toBe('tei');
    expect(schema.name).toBe('CBETA P5');
  });
});
