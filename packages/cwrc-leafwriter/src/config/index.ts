import { db } from '../db';
import type { LeafWriterOptionsSettings, Schema } from '../types';
import { SchemaMappings } from '../types';
import { isValidHttpURL } from '../utilities';
import { schemas as defaultSchemas } from './schemas';

export const createConfig = async (settings: LeafWriterOptionsSettings = {}) => {
  const { baseUrl, readonly, schemas: configSchemas } = settings;
  const supportedSchemas = configSchemas ? [...configSchemas, ...defaultSchemas] : defaultSchemas;
  const schemas = await setupSchemas(supportedSchemas);

  const defaultModules = {
    west: [
      { id: 'toc' as const, title: 'Table of Contents' },
      { id: 'markup' as const, title: 'Markup' },
      { id: 'entities' as const, title: 'Entities' },
    ],
    east: [
      { id: 'code' as const, title: 'Raw XML' },
      { id: 'imageViewer' as const, title: 'Image Viewer' },
      { id: 'validation' as const, title: 'Validation' },
    ],
  };

  const config: LeafWriterOptionsSettings = {
    container: 'leaft-writer-app',
    baseUrl: baseUrl ?? '.',
    readonly,
    schemas,
    modules: settings.modules ?? defaultModules,
  };

  return config;
};

export const setupSchemas = async (schemas: Schema[]) => {
  const customSchemas = await db.customSchemas.toArray();
  if (customSchemas) schemas = [...schemas, ...customSchemas];

  let supportedSchemas: Schema[] = [];

  for (const schema of schemas) {
    const exists = supportedSchemas.some(({ id }) => id === schema.id);
    if (exists) continue;

    const { id, name, mapping, rng, css, editable } = schema;

    if (!id || typeof id !== 'string' || id === '') continue;
    if (!name || typeof name !== 'string' || name.length < 3 || name.length > 20) continue;
    if (!mapping || !SchemaMappings.includes(mapping)) continue;

    const isSchemaLocator = (url: string) =>
      isValidHttpURL(url) || url.startsWith('blob:') || url.startsWith('crcao://');
    const validRng = rng.filter((url) => isSchemaLocator(url));
    if (validRng.length === 0) continue;

    const validCss = css.filter((url) => isSchemaLocator(url));
    if (validCss.length === 0) continue;

    supportedSchemas = [
      ...supportedSchemas,
      { id, name, mapping, rng: validRng, css: validCss, editable },
    ];
  }

  return supportedSchemas;
};
