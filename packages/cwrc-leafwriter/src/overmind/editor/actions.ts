import $ from 'jquery';
import Cookies from 'js-cookie';
import { json } from 'overmind';
import { Context } from '../';
import { db } from '../../db';
import type {
  AuthorityService,
  AuthorityServiceConfig,
  NamedEntityType,
} from '../../types/authority';
import type { LeafWriterOptionsSettings, Schema } from '../../types';
import { log } from './../../utilities';

const DIALOG_PREFS_COOKIE_NAME = 'leaf-writer-base-dialog-preferences';

export const writerInitSettings = async (
  { state: { editor }, actions }: Context,
  settings: LeafWriterOptionsSettings,
) => {
  const { baseUrl, schemas } = settings;

  editor.baseUrl = baseUrl;
  editor.settings = settings;

  const schemaObjs: Record<string, Schema> = {};
  schemas?.forEach((element) => (schemaObjs[element.id] = element));

  editor.schemas = schemaObjs;

  actions.editor.setReadonly(settings.readonly);
  await actions.validator.loadValidator();
};

export const configureAuthorityServices = async (
  { state, actions, effects }: Context,
  configAuthorityServices?: AuthorityServiceConfig[],
) => {
  const { authorityServices } = state.editor;

  //* no config, use default
  if (!configAuthorityServices) {
    effects.editor.api.setDefaultAuthorityServices(json(authorityServices));
    await actions.editor.applyUserPreferencesAuthrityServices();
    return;
  }

  //* config services
  configAuthorityServices.forEach((serviceConfig) => {
    if (typeof serviceConfig === 'string') {
      authorityServices[serviceConfig];
      return;
    }

    // * Get authority service to configure
    const authorityService = authorityServices[serviceConfig.id];

    // * Implements new authority service
    if (!authorityService) {
      //TODO Implements new authority service
      return;
    }

    //* Disable service
    authorityService.disabled = serviceConfig.disabled;

    //*  No entities, use default
    if (!serviceConfig.entities) return;

    //* entity types
    for (const entity in serviceConfig.entities) {
      if (!authorityService.entities[entity as NamedEntityType]) continue;
      if (!Object.prototype.hasOwnProperty.call(serviceConfig.entities, entity)) continue;

      const value = serviceConfig.entities[entity as NamedEntityType];
      if (value) authorityService.entities[entity as NamedEntityType] = value;
    }
  });

  // * Setup default
  effects.editor.api.setDefaultAuthorityServices(json(authorityServices));
  await actions.editor.applyUserPreferencesAuthrityServices();
};

const sanitazeAuthorityServices = (services: AuthorityService[]) => {
  const sininatizedPreferences = services.map((service) => {
    if (service.serviceSource !== 'LINCS') {
      const { find, ...rest } = service;
      return rest;
    }
    return service;
  });
  return sininatizedPreferences;
};

export const applyUserPreferencesAuthrityServices = async ({ state }: Context) => {
  const { authorityServices } = state.editor;

  //* No user preferences, add once.
  const count = await db.authorityServices.count();
  if (count === 0) {
    const preferences: AuthorityService[] = Object.values(json(authorityServices));
    const saninatizedPreferences = sanitazeAuthorityServices(preferences);
    await db.authorityServices.bulkAdd(saninatizedPreferences);
    return;
  }

  const preferences = await db.authorityServices.toArray();

  for (const servicePreference of preferences) {
    // * Get authority service to configure
    const authorityService = authorityServices[servicePreference.id];

    // * Remove not available service from preferences
    if (!authorityService) {
      log.warn(
        `Authority Service Preferences: authority ${servicePreference.id} no longer available `,
      );
      await db.authorityServices.delete(servicePreference.id);
      continue;
    }

    //* Priority
    authorityService.priority = servicePreference.priority;

    //* disabled service
    authorityService.disabled = servicePreference.disabled;

    //*  No entities, use default
    if (!servicePreference.entities) continue;

    //* entity types
    const entitiesToRemove: NamedEntityType[] = [];
    for (const entity in servicePreference.entities) {
      if (!Object.prototype.hasOwnProperty.call(servicePreference.entities, entity)) continue;
      if (!authorityService.entities[entity as NamedEntityType]) {
        log.warn(
          `Authority Service Preferences: authority ${servicePreference.id} no longer accept entity ${entity}`,
        );

        entitiesToRemove.push(entity as NamedEntityType);
        delete servicePreference.entities[entity as NamedEntityType];
        continue;
      }

      const value = servicePreference.entities[entity as NamedEntityType];
      if (value !== undefined) authorityService.entities[entity as NamedEntityType] = value;
    }

    if (entitiesToRemove.length > 0) {
      await db.authorityServices.update(servicePreference.id, {
        entities: servicePreference.entities,
      });
    }
  }
};

export const applyInitialSettings = ({ state, actions }: Context) => {
  if (!window.writer?.editor) return;

  actions.editor.setFontSize(state.editor.fontSize);
  const body = window.writer.editor.getBody();
  if (state.editor.showEntities) $(body).addClass('showEntities');
  if (state.editor.showTags) $(body).addClass('showTags');
};

export const setAutosave = ({ state }: Context, value?: boolean) => {
  state.editor.autosave = value;
};

export const suspendLWChangeEvent = async ({ state }: Context, value: boolean) => {
  if (!window.writer?.editor) return;

  const { uuid } = window.writer;
  state.editor.LWChangeEventSuspended = value;

  if (value) {
    const content = await window.writer.getContent();
    if (typeof content !== 'string') return;
    await db.suspendedDocuments.put({ content, uuid }, uuid);
  } else {
    await db.suspendedDocuments.delete(uuid);
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

export const setShowEntities = ({ state }: Context, value: boolean) => {
  if (!window.writer?.editor) return;

  $('body', window.writer.editor.getDoc()).toggleClass('showEntities');
  state.editor.showEntities = value;
};

export const toggleAdvancedSettings = ({ state }: Context, value: boolean) => {
  state.editor.advancedSettings = value;
};

export const setReadonly = ({ state }: Context, value = false) => {
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
export const addSchema = async ({ state }: Context, newSchema: Omit<Schema, 'id'>) => {
  if (!window.writer?.editor) return;

  const schema = window.writer.schemaManager.addSchema({ ...newSchema, editable: true });
  state.editor.schemas[schema.id] = schema;

  await db.customSchemas.add(schema);

  return schema;
};

/**
 * Updates a schema
 * @param updatedSchema - Schema - this is the updated schema that we're going to use to
 * update the schemas array.
 * @returns The updated schema.
 */
export const updateSchema = async ({ state }: Context, updatedSchema: Schema) => {
  if (!window.writer?.editor) return;
  window.writer.schemaManager.updateSchema(updatedSchema);
  state.editor.schemas[updatedSchema.id] = updatedSchema;

  await db.customSchemas.put(updatedSchema);

  return updatedSchema;
};

/**
 * It takes a schemaId as an argument, and then filters the schemas array to remove the schema with
 * the matching id
 * @param {string} schemaId - The id of the schema to delete
 */
export const deleteSchema = async ({ state }: Context, schemaId: string) => {
  if (!window.writer?.editor) return;
  window.writer.schemaManager.deleteSchema(schemaId);

  const updatedSchemaList = state.editor.schemasList.filter((schema) => schema.id !== schemaId);

  const schemaObjs: Record<string, Schema> = {};
  updatedSchemaList.forEach((element) => (schemaObjs[element.id] = element));

  state.editor.schemas = schemaObjs;

  await db.customSchemas.delete(schemaId);
};

export const getSchemsByMappingId = ({ state }: Context, mappingId: string) => {
  return state.editor.schemasList.filter((schema) => schema.mapping === mappingId);
};

export const resetDialogWarnings = async ({ actions }: Context) => {
  Cookies.remove(DIALOG_PREFS_COOKIE_NAME, { path: '' });
  await actions.ui.resetDoNotDisplayDialogs();
};

export const resetPreferences = async ({ state, actions, effects }: Context) => {
  actions.editor.setFontSize(11);
  actions.editor.toggleShowTags(false);
  actions.editor.setShowEntities(true);
  actions.editor.setEditorMode('xmlrdf');
  actions.editor.setAnnotationrMode(3);

  //* Authority service
  const defaultAuthorityServices = effects.editor.api.getDefaultAuthorityServices();
  if (defaultAuthorityServices) {
    state.editor.authorityServices = defaultAuthorityServices;
    const saninatizedPrefs = sanitazeAuthorityServices(Object.values(defaultAuthorityServices));
    await db.authorityServices.bulkPut(saninatizedPrefs);
  } else {
    await db.authorityServices.clear();
  }

  await actions.ui.resetDoNotDisplayDialogs();

  actions.ui.resetPreferences();
};

export const setIsAnnotator = ({ state }: Context, value: boolean) => {
  state.editor.isAnnotator = value;
};

export const toggleLookupAuthority = async (
  { state: { editor } }: Context,
  authorityId: string,
) => {
  const authorityService = editor.authorityServices[authorityId];
  if (!authorityService) return;

  authorityService.disabled = !authorityService.disabled;

  await db.authorityServices.update(authorityId, { disabled: authorityService.disabled });
};

export const toggleLookupEntity = async (
  { state }: Context,
  { authorityId, entityName }: { authorityId: string; entityName: NamedEntityType },
) => {
  const authorityService = state.editor.authorityServices[authorityId];
  if (!authorityService) return;

  authorityService.entities[entityName] = !authorityService.entities[entityName];

  await db.authorityServices.update(authorityId, {
    entities: json(authorityService.entities),
  });
};

export const reorderLookupPriority = async (
  { state }: Context,
  authorities: AuthorityService[],
) => {
  authorities.forEach((authority, index) => {
    const authorityService = state.editor.authorityServices[authority.id];
    if (!authorityService) return;
    authorityService.priority = index;
  });

  const preferences: AuthorityService[] = Object.values(json(state.editor.authorityServices));

  const saninatizedPreferences = sanitazeAuthorityServices(preferences);
  await db.authorityServices.bulkPut(saninatizedPreferences);
};

export const getContent = async ({ state }: Context) => {
  if (state.editor.LWChangeEventSuspended) {
    if (!window.writer?.editor) return;

    const { uuid } = window.writer;
    const suspended = await db.suspendedDocuments.get(uuid);
    if (!suspended) return;

    return suspended.content;
  }
  return await window.writer.getContent();
};

export const setContentHasChanged = ({ state }: Context, value: boolean) => {
  state.editor.contentHasChanged = value;
};

export const closeEditor = ({ state }: Context) => {
  state.editor.latestEvent = 'close';
};

export const clear = ({ state }: Context) => {
  state.editor.LWChangeEventSuspended = false;
  state.editor.advancedSettings = true;
  state.editor.allowOverlap = false;
  state.editor.annotationMode = 3;
  state.editor.contentHasChanged = false;
  state.editor.editorMode = 'xmlrdf';
  state.editor.fontSize = 11;
  state.editor.isAnnotator = false;
  state.editor.isReadonly = false;
  state.editor.mode = 0;
  state.editor.showEntities = true;
  state.editor.showEntities = true;
  state.editor.showTags = false;
};
