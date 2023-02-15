import $ from 'jquery';
import Cookies from 'js-cookie';
import { Context } from '../';
import { db } from '../../db';
import type {
  Authority,
  AuthorityService,
  LookupsConfig,
  LookupsProps,
  NamedEntityType,
} from '../../dialogs/entityLookups/types';
import type { LeafWriterOptionsSettings, Schema } from '../../types';
import { log } from './../../utilities';

const DIALOG_PREFS_COOKIE_NAME = 'leaf-writer-base-dialog-preferences';

export const writerInitSettings = (
  { state: { editor }, actions }: Context,
  settings: LeafWriterOptionsSettings
) => {
  const { baseUrl, schemas } = settings;

  editor.baseUrl = baseUrl;
  editor.settings = settings;

  const schemaObjs = {};
  schemas.forEach((element) => (schemaObjs[element.id] = element));

  editor.schemas = schemaObjs;

  actions.editor.setReadonly(settings.readonly);
  actions.validator.loadValidator();
};

export const initiateLookupServices = async ({ state, actions, effects }: Context) => {
  // log.info(serviceType);
  // serviceType = 'nssi';
  const _token = await state.editor.nssiToken;
  const token = await actions.editor.getNssiToken();

  await effects.lookups.api.initialize(state.editor.lookups.authorities, { token });
};

export const initiateLookupSources = async (
  { state, actions, effects }: Context,
  config?: LookupsConfig
) => {
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
  if (!config.authorities || !Array.isArray(config.authorities)) return;

  config.authorities.forEach((confgAuthority) => {
    const [authorityId, configAuthorityService] =
      typeof confgAuthority === 'string' ? [confgAuthority] : confgAuthority;

    if (authorityId !== state.editor.lookups.authorities[authorityId].id) {
      // implement new lookup
      return;
    }

    //required authentication?
    if (
      state.editor.lookups.authorities[authorityId].requireAuth &&
      configAuthorityService?.config?.username === ''
    ) {
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
    if (!configAuthorityService.entities || !Array.isArray(configAuthorityService.entities)) return;

    //entity types
    configAuthorityService.entities.forEach(([entityName, enabled]) => {
      state.editor.lookups.authorities[authorityId].entities[entityName] = enabled;
    });
  });

  // * Setup default
  effects.editor.api.setLookupsDefaults({ ...state.editor.lookups });

  // * User saved preferences
  const savedPreferences = actions.editor.retrieveLookupAutoritiesConfig();
  if (savedPreferences) state.editor.lookups = savedPreferences;

  // * Setup services
  await actions.editor.initiateLookupServices();
};

export const applyInitialSettings = ({ state, actions }: Context) => {
  if (!window.writer?.editor) return;

  actions.editor.setFontSize(state.editor.fontSize);
  const body = window.writer.editor.getBody();
  if (state.editor.showEntities) $(body).addClass('showEntities');
  if (state.editor.showTags) $(body).addClass('showTags');
};

export const setNssiToken = (
  { state }: Context,
  value: string | (() => Promise<string | undefined>)
) => {
  state.editor.nssiToken = value;
};

export const getNssiToken = async ({ state }: Context) => {
  const { nssiToken } = state.editor;
  // if (!nssiToken) throw Error('Nssi token was not set up');
  if (!nssiToken) {
    // log.error('Nssi token was not set up');
    return;
  }

  const token = typeof nssiToken === 'string' ? nssiToken : await nssiToken();
  return token;
};

export const setAutosave = ({ state }: Context, value?: boolean) => {
  state.editor.autosave = value;
};

export const suspendLWChangeEvent = async ({ state, actions }: Context, value: boolean) => {
  state.editor.LWChangeEventSuspended = value;

  if (value) {
    const content = await window.writer.getContent();
    await db.suspendedDocument.add({ content });
  } else {
    await db.suspendedDocument.clear();
    state.editor.contentHasChanged = true;
  }
};

export const setFontSize = ({ state }: Context, value: number) => {
  if (!window.writer?.editor) return;

  const styles = { fontSize: `${value}pt` };
  window.writer.editor.dom.setStyles(window.writer.editor.dom.getRoot(), styles);
  state.editor.fontSize = value;
};

export const toggleShowTags = ({ state }: Context, value?: boolean) => {
  if (!window.writer?.editor) return;
  if (!value) value = !state.editor.showTags;

  $('body', window.writer.editor.getDoc()).toggleClass('showTags');
  state.editor.showTags = value;
};

export const showEntities = ({ state }: Context, value: boolean) => {
  if (!window.writer?.editor) return;

  $('body', window.writer.editor.getDoc()).toggleClass('showEntities');
  state.editor.showEntities = value;
};

export const toggleAdvancedSettings = ({ state }: Context, value: boolean) => {
  state.editor.advancedSettings = value;
};

export const setReadonly = ({ state }: Context, value: boolean = false) => {
  state.editor.isReadonly = value;
};

export const setEditorMode = ({ state }: Context, editorMode: string) => {
  if (!window.writer?.editor) return;

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

export const getEditorModeByKey = ({ state }: Context, key: number) => {
  return state.editor.editorModes.find((editorMode) => editorMode.key === key);
};

export const getEditorModeByValue = ({ state }: Context, value: string) => {
  return state.editor.editorModes.find((editorMode) => editorMode.value === value);
};

export const setAnnotationrMode = ({ state }: Context, value: number) => {
  if (!window.writer?.editor) return;

  window.writer.annotationMode = value;
  state.editor.annotationMode = value;
  return state.editor.annotationModes.find((annotationMode) => annotationMode.value === value);
};

/**
 * It adds a new schema to the list of schemas
 * @param schema - Omit<Schema, 'id'>
 * @returns The new schema that was added.
 */
export const addSchema = ({ state, effects }: Context, newSchema: Omit<Schema, 'id'>) => {
  if (!window.writer?.editor) return;
  const schema = window.writer.schemaManager.addSchema({ ...newSchema, editable: true });
  state.editor.schemas[schema.id] = schema;

  //Add to localstorage
  let customSchemas: Schema[] = effects.editor.api.getFromLocalStorage('custom_schemas');
  customSchemas = customSchemas ?? [];

  customSchemas.push(schema);
  effects.editor.api.saveToLocalStorage('custom_schemas', customSchemas);

  return schema;
};

/**
 * Updates a schema
 * @param updatedSchema - Schema - this is the updated schema that we're going to use to
 * update the schemas array.
 * @returns The updated schema.
 */
export const updateSchema = ({ state, effects }: Context, updatedSchema: Schema) => {
  if (!window.writer?.editor) return;
  window.writer.schemaManager.updateSchema(updatedSchema);
  state.editor.schemas[updatedSchema.id] = updatedSchema;

  //update localstorage
  let customSchemas: Schema[] = effects.editor.api.getFromLocalStorage('custom_schemas');
  if (!customSchemas) return updatedSchema;

  customSchemas = customSchemas.map((schema) =>
    schema.id === updatedSchema.id ? updatedSchema : schema
  );
  effects.editor.api.saveToLocalStorage('custom_schemas', customSchemas);

  return updatedSchema;
};

/**
 * It takes a schemaId as an argument, and then filters the schemas array to remove the schema with
 * the matching id
 * @param {string} schemaId - The id of the schema to delete
 */
export const deleteSchema = ({ state, effects }: Context, schemaId: string) => {
  if (!window.writer?.editor) return;
  window.writer.schemaManager.deleteSchema(schemaId);

  const updatedSchemaList = state.editor.schemasList.filter((schema) => schema.id !== schemaId);

  const schemaObjs = {};
  updatedSchemaList.forEach((element) => (schemaObjs[element.id] = element));

  state.editor.schemas = schemaObjs;

  //remove from localstorage
  let customSchemas: Schema[] = effects.editor.api.getFromLocalStorage('custom_schemas');
  if (!customSchemas) return;

  customSchemas = customSchemas.filter((schema) => schema.id !== schemaId);
  effects.editor.api.saveToLocalStorage('custom_schemas', customSchemas);
};

export const getSchemsByMappingId = ({ state }: Context, mappingId: string) => {
  return state.editor.schemasList.filter((schema) => schema.mapping === mappingId);
};

export const resetDialogWarnings = ({ actions }: Context) => {
  Cookies.remove(DIALOG_PREFS_COOKIE_NAME, { path: '' });
  actions.ui.resetDoNotDisplayDialogs();
};

export const resetPreferences = ({ state, actions, effects }: Context) => {
  if (state.editor.fontSize !== 11) actions.editor.setFontSize(11);
  if (state.editor.showTags !== false) actions.editor.toggleShowTags(false);
  if (state.editor.showEntities !== true) actions.editor.showEntities(true);
  if (state.editor.editorMode !== 'xmlrdfoverlap') actions.editor.setEditorMode('xmlrdf');
  if (state.editor.annotationMode !== 3) actions.editor.setAnnotationrMode(3);

  effects.editor.api.removeFromLocalStorage('lookup_preferences');

  const lookupsDefault = effects.editor.api.getLookupsDefaults();
  if (lookupsDefault) state.editor.lookups = lookupsDefault;

  actions.ui.resetPreferences();
};

export const getSettings = ({ state }: Context, config?: string) => {
  return {
    isAdvanced: true,
    fontSize: state.editor.fontSize,
    showEntities: state.editor.showEntities,
    showTags: state.editor.showTags,
    mode: state.editor.mode,
    editorMode: state.editor.editorMode,
    annotationMode: state.editor.annotationMode,
    allowOverlap: state.editor.allowOverlap,

    schemaId: state.document.schemaId,
  };
};

export const setIsAnnotator = ({ state }: Context, value: boolean) => {
  state.editor.isAnnotator = value;
};

export const toggleLookupAuthority = ({ state: { editor }, effects }: Context, id: Authority) => {
  if (!editor.lookups.authorities) return;

  const authorityService = editor.lookups.authorities[id];
  if (!authorityService) return;
  authorityService.enabled = !authorityService.enabled;

  //deactivate // reactivate  entities
  [...Object.entries(authorityService.entities)].forEach(([namedEntityType]) => {
    authorityService.entities[namedEntityType] = authorityService.enabled;
  });

  effects.editor.api.saveToLocalStorage('lookup_preferences', editor.lookups);
};

export const toggleLookupEntity = (
  { state: { editor }, effects }: Context,
  { authorityId, entityName }: { authorityId: Authority; entityName: NamedEntityType }
) => {
  const authorityService = editor.lookups.authorities[authorityId];
  if (authorityService.entities[entityName] === undefined) return;

  const entityEnabled = authorityService.entities[entityName];
  authorityService.entities[entityName] = !entityEnabled;

  effects.editor.api.saveToLocalStorage('lookup_preferences', editor.lookups);
};

export const reorderLookupPriority = (
  { state: { editor }, effects }: Context,
  authorities: AuthorityService[]
) => {
  if (!editor.lookups.authorities) return;

  authorities.forEach((authority, index) => {
    if (!editor.lookups.authorities) return;
    editor.lookups.authorities[authority.id].priority = index;
  });

  effects.editor.api.saveToLocalStorage('lookup_preferences', editor.lookups);
};

export const retrieveLookupAutoritiesConfig = ({ effects }: Context) => {
  const prefs: LookupsProps = effects.editor.api.getFromLocalStorage('lookup_preferences');
  return prefs;
};

export const getContent = async ({ state }: Context) => {
  if (state.editor.LWChangeEventSuspended) {
    const suspended = db.suspendedDocument.toCollection();
    const document = await suspended.last();

    return document.content;
  }
  return await window.writer.getContent();
};

export const setContentHasChanged = ({ state }: Context, value: boolean) => {
  state.editor.contentHasChanged = value;
}

export const closeEditor = ({ state }: Context) => {
  state.editor.latestEvent = 'close';
};

export const clear = ({ state }: Context) => {
  state.editor.advancedSettings = true;
  state.editor.allowOverlap = false;
  state.editor.annotationMode = 3;
  state.editor.fontSize = 11;
  state.editor.editorMode = 'xmlrdf';
  state.editor.isAnnotator = false;
  state.editor.isReadonly = false;
  state.editor.mode = 0;
  state.editor.showEntities = true;
  state.editor.showTags = false;
  state.editor.schemas = {};
};
