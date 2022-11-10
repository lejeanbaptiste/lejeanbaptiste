import type { ILeafWriterOptionsSettings, Schema } from '../types';
import { SchemaMappings } from '../types';
import { isValidHttpURL } from '../utilities';
import { schemas as defaultSchemas } from './schemas';

export const createConfig = ({ baseUrl, schemas: configSchemas }: ILeafWriterOptionsSettings) => {
  const supportedSchemas = configSchemas ? [...configSchemas, ...defaultSchemas] : defaultSchemas;
  const schemas = setupSchemas(supportedSchemas);

  const config: ILeafWriterOptionsSettings = {
    container: 'leaft-writer-app',
    baseUrl: baseUrl ?? '.',
    schemas,
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

export const setupSchemas = (schemas: Array<Schema>) => {
  //add custom schemas stored on local storage
  const customSchemasData = window.localStorage.getItem('custom_schemas');
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
