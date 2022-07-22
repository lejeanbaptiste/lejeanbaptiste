import $ from 'jquery';
import Cookies from 'js-cookie';
import { log } from './../../utilities';
const DIALOG_PREFS_COOKIE_NAME = 'leaf-writer-base-dialog-preferences';
export const writerInitSettings = ({ state: { editor }, actions }, settings) => {
    const { baseUrl, schemas } = settings;
    editor.baseUrl = baseUrl;
    editor.settings = settings;
    editor.schemas = schemas;
    actions.validator.loadValidator();
};
export const initiateLookupServices = async ({ state, actions, effects }) => {
    // log.info(serviceType);
    // serviceType = 'nssi';
    const _token = await state.editor.nssiToken;
    const token = await actions.editor.getNssiToken();
    await effects.lookups.api.initialize(state.editor.lookups.authorities, { token });
};
export const initiateLookupSources = async ({ state, actions, effects }, config) => {
    const { lookups } = state.editor;
    //* no config, use default
    if (!config) {
        await actions.editor.initiateLookupServices();
        effects.editor.api.setLookupsDefaults({ ...lookups });
        return;
    }
    if (typeof config?.serviceType === 'string' && ['custom', 'nssi'].includes(config.serviceType)) {
        state.editor.lookups.serviceType = config.serviceType;
    }
    //* no config, use default
    if (!config.authorities || !Array.isArray(config.authorities))
        return;
    config.authorities.forEach((confgAuthority) => {
        const [authorityId, configAuthorityService] = typeof confgAuthority === 'string' ? [confgAuthority] : confgAuthority;
        if (authorityId !== state.editor.lookups.authorities[authorityId].id) {
            // implement new lookup
            return;
        }
        //required authentication?
        if (state.editor.lookups.authorities[authorityId].requireAuth &&
            configAuthorityService?.config?.username === '') {
            log.warn(`Lookups: You must define a username to make requests to ${authorityId}`);
            return;
        }
        //* No config, enabled and use default
        if (!configAuthorityService) {
            if (!state.editor.lookups.authorities[authorityId].enabled) {
                actions.editor.toggleLookupAuthority(authorityId);
            }
            return;
        }
        //config
        if (configAuthorityService.config) {
            state.editor.lookups.authorities[authorityId].config = configAuthorityService.config;
            state.editor.lookups.authorities[authorityId].enabled = true;
        }
        //enabled
        if (configAuthorityService.enabled) {
            state.editor.lookups.authorities[authorityId].enabled = configAuthorityService.enabled;
        }
        //if not entities, use default
        if (!configAuthorityService.entities || !Array.isArray(configAuthorityService.entities))
            return;
        //entity types
        configAuthorityService.entities.forEach(([entityName, enabled]) => {
            state.editor.lookups.authorities[authorityId].entities[entityName] = enabled;
        });
    });
    // * Setup default
    effects.editor.api.setLookupsDefaults({ ...state.editor.lookups });
    // * User saved preferences
    const savedPreferences = actions.editor.retrieveLookupAutoritiesConfig();
    if (savedPreferences)
        state.editor.lookups = savedPreferences;
    // * Setup services
    await actions.editor.initiateLookupServices();
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
    const authorityService = editor.lookups.authorities[id];
    if (!authorityService)
        return;
    authorityService.enabled = !authorityService.enabled;
    //deactivate // reactivate  entities
    [...Object.entries(authorityService.entities)].forEach(([namedEntityType]) => {
        authorityService.entities[namedEntityType] = authorityService.enabled;
    });
    effects.editor.api.saveToLocalStorage('lookup_preferences', JSON.stringify(editor.lookups));
};
export const toggleLookupEntity = ({ state: { editor }, effects }, { authorityId, entityName }) => {
    const authorityService = editor.lookups.authorities[authorityId];
    if (authorityService.entities[entityName] === undefined)
        return;
    const entityEnabled = authorityService.entities[entityName];
    authorityService.entities[entityName] = !entityEnabled;
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