import { schemas as defaultSchemas } from './schemas';
export const createConfig = (settings) => {
    const supportedSchemas = setupSupportedSchemas(settings.schemas ?? settings.schemasId);
    const config = {
        container: 'leaft-writer-app',
        baseUrl: settings.baseUrl,
        nerveUrl: settings.nerveUrl,
        proxyLoaders: settings.proxyLoaders,
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
        services: { nerve: { url: settings.nerveUrl } },
    };
    return config;
};
export const setupSupportedSchemas = (schemas) => {
    if (!schemas)
        return defaultSchemas;
    let supportedSchemas = [];
    for (const schema of schemas) {
        if (typeof schema === 'string') {
            const defaultSchema = defaultSchemas.find(({ id }) => id === schema);
            const exists = supportedSchemas.some(({ id }) => id === schema);
            if (defaultSchema && !exists)
                supportedSchemas = [...supportedSchemas, defaultSchema];
            return;
        }
        const exists = supportedSchemas.some(({ id }) => id === schema.id);
        const isValid = schema.mapId !== null &&
            schema.name !== null &&
            typeof schema.xml === 'string' &&
            isValidURL(schema.xml);
        if (!exists && isValid)
            supportedSchemas = [...supportedSchemas, schema];
    }
    return supportedSchemas;
};
const isValidURL = (value) => {
    const res = value.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    return res !== null;
};
//# sourceMappingURL=index.js.map