import type { LeafWriterOptionsSettings, Schema } from '../types';
import { SchemaMappings } from '../types';
import { isValidHttpURL } from '../utilities';
import { schemas as defaultSchemas } from './schemas';

export * from './language';

export const createConfig = (settings: LeafWriterOptionsSettings = {}) => {
  const { baseUrl, readonly, schemas: configSchemas } = settings;
  const supportedSchemas = configSchemas ? [...configSchemas, ...defaultSchemas] : defaultSchemas;
  const schemas = setupSchemas(supportedSchemas);

  const config: LeafWriterOptionsSettings = {
    container: 'leaft-writer-app',
    baseUrl: baseUrl ?? '.',
    readonly,
    schemas,
    modules: {
      west: [
        { id: 'toc', title: 'Table of Contents' },
        { id: 'markup', title: 'Markup' },
        { id: 'entities', title: 'Entities' },
      ],
      east: [
        { id: 'selection', title: 'Raw XML' },
        { id: 'imageViewer', title: 'Image Viewer' },
        { id: 'validation', title: 'Validation' },
      ],
    },
  };

  return config;
};

export const setupSchemas = (schemas: Array<Schema>) => {
  //add custom schemas stored on local storage
  const customSchemasData = localStorage.getItem('custom_schemas');
  if (customSchemasData) schemas = [...schemas, ...JSON.parse(customSchemasData)];

  let supportedSchemas: Schema[] = [];

  for (const schema of schemas) {
    const exists = supportedSchemas.some(({ id }) => id === schema.id);
    if (exists) continue;

    const { id, name, mapping, rng, css, editable } = schema;

    if (!id || typeof id !== 'string' || id === '') continue;
    if (!name || typeof name !== 'string' || name.length < 3 || name.length > 20) continue;
    if (!mapping || !SchemaMappings.includes(mapping)) continue;

    const validRng = rng.filter((url) => isValidHttpURL(url));
    if (validRng.length === 0) continue;

    const validCss = css.filter((url) => isValidHttpURL(url));
    if (validCss.length === 0) continue;

    supportedSchemas = [
      ...supportedSchemas,
      { id, name, mapping, rng: validRng, css: validCss, editable },
    ];
  }

  return supportedSchemas;
};
