import type { ConfigLegacy, LeafWriterConfig, Schema, SupportedSchemasId } from '../@types';
import { schemas as defaultSchemas } from './schemas';

export const createConfigLegacy = ({ editor }: LeafWriterConfig) => {
  if (!editor.legacy) return {} as ConfigLegacy;

  const { cwrcRootUrl, helpUrl, nerveUrl, proxyCssEndpoint, proxyXmlEndpoint } = editor.legacy;

  const supportedSchemas = setupSupportedSchemas(editor.schemas);

  const config: ConfigLegacy = {
    container: 'leaft-writer-app',
    cwrcRootUrl,
    helpUrl,
    nerveUrl,
    schema: {
      proxyCssEndpoint: proxyCssEndpoint ?? undefined,
      proxyXmlEndpoint: proxyXmlEndpoint ?? undefined,
      schemas: supportedSchemas,
    },
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
    services: { nerve: { url: nerveUrl } },
  };

  return config;
};

const setupSupportedSchemas = (schemas?: [SupportedSchemasId | Schema]) => {
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
      schema.mapId !== null &&
      schema.name !== null &&
      typeof schema.xml === 'string' &&
      isValidURL(schema.xml);
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
