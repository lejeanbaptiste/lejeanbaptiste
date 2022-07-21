import { derived } from 'overmind';
export const state = {
    advancedSettings: true,
    allowOverlap: false,
    annotationMode: 3,
    annotationModes: [
        { value: 1, label: 'RDF/XML', disabled: true },
        { value: 3, label: 'JSON-LD' },
    ],
    annotationModeLabel: derived((state) => {
        const annotatonMode = state.annotationModes.find((mode) => mode.value === state.annotationMode);
        if (!annotatonMode)
            return '';
        return annotatonMode.label;
    }),
    baseUrl: '.',
    currentFontSize: 11,
    editorMode: 'xmlrdf',
    editorModeLabel: derived((state) => {
        const editMode = state.editorModes.find((mode) => mode.value === state.editorMode);
        if (!editMode)
            return '';
        return editMode.label;
    }),
    editorModes: [
        { key: 1, value: 'xml', label: 'XML only (no overlap)' },
        { key: 0, value: 'xmlrdf', label: 'XML and RDF (no overlap)' },
        { key: 0, value: 'xmlrdfoverlap', label: 'XML and RDF (overlapping entities)' },
        { key: 2, value: 'rdf', label: 'RDF only' },
    ],
    fontSizeOptions: [8, 9, 10, 11, 12, 13, 14, 16, 18],
    isEditorDirty: false,
    isAnnotator: false,
    isReadonly: false,
    mode: 0,
    showEntities: true,
    showTags: false,
    schemas: [],
    lookups: {
        authorities: {
            viaf: {
                enabled: true,
                entities: { person: true, place: true, organization: true, title: true, rs: true },
                id: 'viaf',
                name: 'VIAF',
                priority: 0,
            },
            wikidata: {
                enabled: true,
                entities: { person: true, place: true, organization: true, title: true, rs: true },
                id: 'wikidata',
                name: 'Wikidata',
                priority: 1,
            },
            dbpedia: {
                enabled: true,
                entities: { person: true, place: true, organization: true, title: true, rs: true },
                id: 'dbpedia',
                name: 'DBpedia',
                priority: 2,
            },
            getty: {
                enabled: true,
                entities: { person: true, place: true },
                id: 'getty',
                name: 'Getty',
                priority: 3,
            },
            geonames: {
                enabled: false,
                entities: { place: true },
                id: 'geonames',
                name: 'Geonames',
                priority: 4,
                requireAuth: true,
            },
            lgpn: {
                enabled: false,
                entities: { person: false },
                id: 'lgpn',
                name: 'LGPN',
                priority: 5,
            },
        },
        serviceType: 'custom',
    },
};
//# sourceMappingURL=state.js.map