import { Resource } from '../../@types';
import { Context } from '../';

export const setInitialStateSchema = ({ state }: Context, id: string) => {
  state.document.schemaId = id;
};

export const setSchema = ({ state }: Context, id: string) => {
  window.writer?.event('schemaChanged').publish(id);

  state.document.schemaId = id;
  return state.editor.schemas.find((schema) => schema.id === id);
};

export const setDocumentUrl = ({ state }: Context, url: string) => {
  state.document.url = url;
};

export const setResource = ({ state }: Context, resource: Resource) => {
  state.document.resource = { ...resource };
};

export const updateResourceHash = ({ state }: Context, hash: string) => {
  if (!state.document.resource) return;
  state.document.resource.hash = hash;
  state.editor.isEditorDirty = false;
};

export const updateContent = ({ state }: Context, content: string) => {
  if (!state.document.resource) return;
  state.document.resource.content = content;
};

export const clear = ({ state }: Context) => {
  state.document.resource = undefined;
  state.document.schemaId = '';
  state.document.url = undefined;
};

export const loadDocumentXML = ({ actions }: Context, content: string) => {
  window.writer?.loadDocumentXML(content);
  actions.document.updateContent(content);
};
