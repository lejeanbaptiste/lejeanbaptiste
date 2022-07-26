import type { ILeafWriterOptionsSettings, Schema, SupportedSchemasId } from '../types';
import { schemas as defaultSchemas } from './schemas';

export const createConfig = (settings: ILeafWriterOptionsSettings) => {
  const supportedSchemas = setupSupportedSchemas(settings.schemas ?? settings.schemasId);

  const config: ILeafWriterOptionsSettings = {
    container: 'leaft-writer-app',
    baseUrl: settings.baseUrl ?? '.',
    schemas: supportedSchemas,
    modules: {
      west: [
        { id: 'structure', title: 'Markup' },
        { id: 'entities', title: 'Entities' },
      ],
      east: [
        { id: 'selection', title: 'Selection' },
        { id: 'imageViewer', title: 'Image Viewer' },
        { id: 'validation', title: 'Validation' },
      ],
    },
  };

  return config;
};

export const setupSupportedSchemas = (schemas?: Array<SupportedSchemasId | Schema>) => {
  if (!schemas) return defaultSchemas;

  let supportedSchemas: Schema[] = [];

  for (const schema of schemas) {
    if (typeof schema === 'string') {
      const defaultSchema = defaultSchemas.find(({ id }) => id === schema);
      const exists = supportedSchemas.some(({ id }) => id === schema);
      if (defaultSchema && !exists) supportedSchemas = [...supportedSchemas, defaultSchema];
      return;
    }
    const exists = supportedSchemas.some(({ id }) => id === schema.id);
    const isValid =
      schema.mapping !== null &&
      schema.name !== null &&
      typeof schema.rng === 'string' &&
      isValidURL(schema.rng);
    if (!exists && isValid) supportedSchemas = [...supportedSchemas, schema];
  }

  return supportedSchemas;
};

const isValidURL = (value: string) => {
  const res = value.match(
    /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
  );
  return res !== null;
};
