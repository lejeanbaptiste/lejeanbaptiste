import $ from 'jquery';
import Cookies from 'js-cookie';
import { log } from './../../utilities';
const DIALOG_PREFS_COOKIE_NAME = 'leaf-writer-base-dialog-preferences';
export const writerInitSettings = ({ state: { editor }, actions }, settings) => {
    const { baseUrl, proxyLoaders, schemas } = settings;
    editor.baseUrl = baseUrl;
    editor.settings = settings;
    editor.proxyLoaderXmlEndpoint = proxyLoaders.xmlEndpoint;
    editor.proxyLoaderCssEndpoint = proxyLoaders.cssEndpoint;
    editor.schemas = schemas;
    actions.validator.loadValidator();
};
export const initiateLookupServices = async ({ state, actions, effects }, serviceType) => {
    // log.info(serviceType);
    // serviceType = 'nssi';
    const _token = await state.editor.nssiToken;
    const token = await actions.editor.getNssiToken();
    await effects.lookups.api.initialize(state.editor.lookups.authorities, { token });
};
export const initiateLookupSources = async ({ state: { editor }, actions, effects }, config) => {
    const { lookups } = editor;
    //* no config, use defal
    if (!config) {
        await actions.editor.initiateLookupServices();
        effects.editor.api.setLookupsDefaults({ ...lookups });
        return;
    }
    if (typeof config?.showNoLinkButton === 'boolean') {
        lookups.showNoLinkButton = config.showNoLinkButton;
    }
    if (typeof config?.showCreateNewButton === 'boolean') {
        lookups.showCreateNewButton = config.showCreateNewButton;
    }
    if (typeof config?.showEditButton === 'boolean') {
        lookups.showEditButton = config.showEditButton;
    }
    if (typeof config?.serviceType === 'string' && ['custom', 'nssi'].includes(config.serviceType)) {
        lookups.serviceType = config.serviceType;
    }
    //* no config, use default
    if (!Array.isArray(config.authorities))
        return;
    const authorities = new Map();
    config.authorities.forEach((config) => {
        const [authorityId, authorityConfig] = typeof config === 'string' ? [config] : config;
        //* invalid
        if (!['cwrc', 'dbpedia', 'geonames', 'getty', 'lgpn', 'viaf', 'wikidata'].includes(authorityId)) {
            return;
        }
        //*  no config, use default
        if (!authorityConfig) {
            if (lookups.authorities[authorityId]) {
                authorities.set(authorityId, lookups.authorities[authorityId]);
            }
            return;
        }
        // * geonames warning
        if (authorityId === 'geonames') {
            if (!authorityConfig.config?.username || authorityConfig.config.username === '') {
                log.warn('Lookups config: You must define a username to be able to make requests to Geonames');
                return;
            }
        }
        //* entities
        let entities = new Map();
        //* no config, use default
        if (!authorityConfig.entities && lookups.authorities[authorityId]) {
            entities = new Map(Object.entries(lookups.authorities[authorityId].entities));
        }
        if (Array.isArray(authorityConfig.entities)) {
            authorityConfig.entities.forEach((config) => {
                const [entityId, entityConfig] = typeof config === 'string' ? [config] : config;
                //* invalid
                if (!['person', 'place', 'organization', 'title', 'rs'].includes(entityId)) {
                    return;
                }
                if (!entityConfig) {
                    //* use dafault
                    entities.set(entityId, lookups.authorities[authorityId].entities[entityId]);
                }
                else {
                    //*  apply config
                    entities.set(entityId, { enabled: entityConfig.enabled, name: entityId });
                }
            });
        }
        // * no entity configured
        if (entities.size === 0)
            return;
        // * push config
        authorities.set(authorityId, {
            config: authorityConfig.config,
            enabled: typeof authorityConfig.enabled === 'boolean' ? authorityConfig.enabled : true,
            entities: Object.fromEntries(entities),
            id: authorityId,
            name: authorityConfig.name,
            priority: authorities.size,
        });
    });
    // * No valid setup
    if (authorities.size === 0)
        return;
    // * Apply config
    lookups.authorities = Object.fromEntries(authorities);
    // * Setup default
    effects.editor.api.setLookupsDefaults({ ...lookups });
    // * User saved preferences
    const savedPreferences = actions.editor.retrieveLookupAutoritiesConfig();
    if (savedPreferences)
        editor.lookups = savedPreferences;
    // * Setup services
    await actions.editor.initiateLookupServices(config.serviceType);
};
export const applyInitialSettings = ({ state, actions }) => {
    if (!window.writer?.editor)
        return;
    actions.editor.setFontSize(state.editor.currentFontSize);
    const body = window.writer.editor.getBody();
    if (state.editor.showEntities)
        $(body).addClass('showEntities');
    if (state.editor.showTags)
        $(body).addClass('showTags');
};
export const setNssiToken = ({ state }, value) => {
    state.editor.nssiToken = value;
};
export const getNssiToken = async ({ state }) => {
    const { nssiToken } = state.editor;
    // if (!nssiToken) throw Error('Nssi token was not set up');
    if (!nssiToken) {
        log.error('Nssi token was not set up');
        return;
    }
    const token = typeof nssiToken === 'string' ? nssiToken : await nssiToken();
    return token;
};
export const setFontSize = ({ state }, value) => {
    if (!window.writer?.editor)
        return;
    const styles = { fontSize: `${value}pt` };
    window.writer.editor.dom.setStyles(window.writer.editor.dom.getRoot(), styles);
    state.editor.currentFontSize = value;
};
export const toggleShowTags = ({ state }, value) => {
    if (!window.writer?.editor)
        return;
    if (!value)
        value = !state.editor.showTags;
    $('body', window.writer.editor.getDoc()).toggleClass('showTags');
    state.editor.showTags = value;
};
export const showEntities = ({ state }, value) => {
    if (!window.writer?.editor)
        return;
    $('body', window.writer.editor.getDoc()).toggleClass('showEntities');
    state.editor.showEntities = value;
};
export const toggleAdvancedSettings = ({ state }, value) => {
    state.editor.advancedSettings = value;
};
export const setReadonly = ({ state }, value) => {
    state.editor.isReadonly = value;
};
export const setEditorMode = ({ state }, editorMode) => {
    if (!window.writer?.editor)
        return;
    const writer = window.writer;
    if (editorMode !== 'xmlrdfoverlap') {
        writer.entitiesManager.removeOverlappingEntities();
        writer.entitiesManager.convertBoundaryEntitiesToTags();
    }
    switch (editorMode) {
        case 'xml':
            state.editor.mode = 1;
            state.editor.allowOverlap = false;
            writer.mode = writer.XML;
            writer.allowOverlap = false;
            break;
        case 'xmlrdf':
            state.editor.mode = 0;
            state.editor.allowOverlap = false;
            writer.mode = writer.XMLRDF;
            writer.allowOverlap = false;
            break;
        case 'xmlrdfoverlap':
            state.editor.mode = 0;
            state.editor.allowOverlap = true;
            writer.mode = writer.XMLRDF;
            writer.allowOverlap = true;
            break;
        case 'rdf':
            state.editor.mode = 2;
            state.editor.allowOverlap = true;
            writer.mode = writer.RDF;
            writer.allowOverlap = true;
    }
    state.editor.editorMode = editorMode;
    return state.editor.editorModes.find((edMode) => edMode.value === editorMode);
};
export const getEditorModeByKey = ({ state }, key) => {
    return state.editor.editorModes.find((editorMode) => editorMode.key === key);
};
export const getEditorModeByValue = ({ state }, value) => {
    return state.editor.editorModes.find((editorMode) => editorMode.value === value);
};
export const setAnnotationrMode = ({ state }, value) => {
    if (!window.writer?.editor)
        return;
    window.writer.annotationMode = value;
    state.editor.annotationMode = value;
    return state.editor.annotationModes.find((annotationMode) => annotationMode.value === value);
};
export const addShema = ({ state }, newSchema) => {
    if (!window.writer?.editor)
        return;
    const schemaId = window.writer.schemaManager.addSchema(newSchema);
    const schema = { ...newSchema, id: schemaId };
    state.editor.schemas = [...state.editor.schemas, schema];
    return schema;
};
export const resetDialogWarnings = ({ state }) => {
    Cookies.remove(DIALOG_PREFS_COOKIE_NAME, { path: '' });
};
export const resetPreferences = ({ state, actions, effects }) => {
    if (state.editor.currentFontSize !== 11)
        actions.editor.setFontSize(11);
    if (state.editor.showTags !== false)
        actions.editor.toggleShowTags(false);
    if (state.editor.showEntities !== true)
        actions.editor.showEntities(true);
    if (state.editor.editorMode !== 'xmlrdfoverlap')
        actions.editor.setEditorMode('xmlrdf');
    if (state.editor.annotationMode !== 3)
        actions.editor.setAnnotationrMode(3);
    effects.editor.api.removeFromLocalStorage('lookup_preferences');
    const lookupsDefault = effects.editor.api.getLookupsDefaults();
    if (lookupsDefault)
        state.editor.lookups = lookupsDefault;
    actions.ui.resetPreferences();
};
export const getSettings = ({ state }, config) => {
    return {
        isAdvanced: true,
        fontSize: state.editor.currentFontSize,
        showEntities: state.editor.showEntities,
        showTags: state.editor.showTags,
        mode: state.editor.mode,
        editorMode: state.editor.editorMode,
        annotationMode: state.editor.annotationMode,
        allowOverlap: state.editor.allowOverlap,
        schemaId: state.document.schemaId,
    };
};
export const setIsAnnotator = ({ state }, value) => {
    state.editor.isAnnotator = value;
};
export const toggleLookupAuthority = ({ state: { editor }, effects }, id) => {
    if (!editor.lookups.authorities)
        return;
    const authority = editor.lookups.authorities[id];
    if (!authority)
        return;
    authority.enabled = !authority.enabled;
    //deactivate // reactivate  entities
    Object.entries(authority.entities).forEach(([entityId]) => {
        authority.entities[entityId].enabled = authority.enabled;
    });
    effects.editor.api.saveToLocalStorage('lookup_preferences', JSON.stringify(editor.lookups));
};
export const toggleLookupEntity = ({ state: { editor }, effects }, { authorityId, entityName }) => {
    if (!editor.lookups.authorities)
        return;
    const authority = editor.lookups.authorities[authorityId];
    const entity = authority.entities[entityName];
    if (!entity)
        return;
    entity.enabled = !entity.enabled;
    effects.editor.api.saveToLocalStorage('lookup_preferences', JSON.stringify(editor.lookups));
};
export const reorderLookupPriority = ({ state: { editor }, effects }, authorities) => {
    if (!editor.lookups.authorities)
        return;
    authorities.forEach((authority, index) => {
        if (!editor.lookups.authorities)
            return;
        editor.lookups.authorities[authority.id].priority = index;
    });
    effects.editor.api.saveToLocalStorage('lookup_preferences', JSON.stringify(editor.lookups));
};
export const retrieveLookupAutoritiesConfig = ({ effects }) => {
    const prefs = effects.editor.api.getFromLocalStorage('lookup_preferences');
    if (!prefs)
        return;
    return JSON.parse(prefs);
};
export const getContent = async ({ state }) => {
    return await window.writer.getContent();
};
export const setIsEditorDirty = ({ state }, value) => {
    state.editor.isEditorDirty = value;
};
export const clear = ({ state }) => {
    state.editor.advancedSettings = true;
    state.editor.allowOverlap = false;
    state.editor.annotationMode = 3;
    state.editor.currentFontSize = 11;
    state.editor.editorMode = 'xmlrdf';
    state.editor.isAnnotator = false;
    state.editor.isReadonly = false;
    state.editor.mode = 0;
    state.editor.showEntities = true;
    state.editor.showTags = false;
    state.editor.schemas = [];
};
//# sourceMappingURL=actions.js.map